import { Container, Text, type Application, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import type { Camera } from "./camera";
import { getLang, t } from "../i18n/index";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { Bench as BenchState, SimEvent } from "../sim/run";
import type { Drop, SkinDef } from "../sim/types";
import type { AudioEngine } from "./audio/AudioEngine";
import { comboPitch } from "./audio/schedule";
import { loadPixelFont, pixelStyle } from "./hd/font";
import { HdLayer } from "./hd/HdLayer";
import { setTweenTimeScale } from "./hd/tween";
import { KnifeFlight } from "./hd/knifeFlight";
import { Lifted } from "./hd/Lifted";
import { Shake } from "./juice/shake";
import { StageLook } from "./juice/stageLook";
import { TimeScale } from "./juice/timeScale";
import { Zoom } from "./juice/zoom";
import { fitCentre, hintKey, revealLines } from "./labels";
import { Bench } from "./pixel/Bench";
import { reelFrameSet } from "./pixel/drawn";
import { tableLayout, type Pt, type TableLayout } from "./pixel/layout";
import { PixelLayer } from "./pixel/PixelLayer";
import { Reel } from "./pixel/Reel";
import { Room } from "./pixel/Room";
import { hdFontSize } from "./pixel/screen";
import { spriteIndex, SpriteLibrary } from "./pixel/sprites";
import { pixelViewport, type PixelViewport } from "./pixel/viewport";
import { restorePlan } from "./restore";
import { crawlSeconds } from "./reel/motion";
import { loadWeaponBases, SkinTextures } from "./skins/pixelSkin";

// Everything drawn on the canvas (spec §2): the pixel world (room, table, your bench, the reel)
// rendered small and scaled up by a whole number, and the HD layer over it (light, dust, glow,
// sparks, coins, text). Sim events drive the juice: sparks, coins, sound, shake, hit-stop and a
// zoom punch on Covert, slow-mo + push-in + flash on ★, and the look of the intensity stage. The
// camera (shake + zoom) moves the whole scene around the reveal; vignette and flash stay put.

/** How far a full-strength tease leans the camera in (a ★ in the top case: 1.15×). */
const TEASE_ZOOM = 0.15;

export class World {
  private readonly scene = new Container();
  private readonly pixel = new PixelLayer();
  private readonly hd: HdLayer;
  private readonly room: Room;
  private readonly bench: Bench;
  private readonly reel: Reel;
  private readonly look: StageLook;
  private readonly shake = new Shake(Math.random, 3);
  private readonly time = new TimeScale();
  private readonly zoom = new Zoom();
  private readonly lifted = new Lifted();
  private knifeFlight!: KnifeFlight;
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xc8cbd6) });
  private readonly label = [new Text({ text: "", style: pixelStyle(8, 0xffffff) }), new Text({ text: "", style: pixelStyle(8, 0xffffff) })];
  private labelSpan = { lo: 0, hi: 0 };
  private readonly offline = new Text({ text: "", style: pixelStyle(8, 0x6a6f80) });
  private vp: PixelViewport;
  private l: TableLayout;
  private screen = { w: 0, h: 0 };
  private lastStage = 1;
  /** The reel windows are drawn in code (no art). */
  private readonly reelFrame = reelFrameSet();
  /** The camera has leaned in on this spin's tease crawl. */
  private leaned = false;
  /** Where the camera pushes in, gliding between the reel (during a tease) and the reveal card. */
  private focus: Pt | null = null;
  private readonly off: () => void;

  static async create(app: Application, controller: GameController, audio: AudioEngine, camera: Camera): Promise<World> {
    await loadPixelFont();
    const lib = await SpriteLibrary.load();
    const bases = await loadWeaponBases(spriteIndex());
    return new World(app, controller, audio, camera, lib, new SkinTextures(bases));
  }

  private constructor(
    private readonly app: Application,
    private readonly controller: GameController,
    private readonly audio: AudioEngine,
    private readonly camera: Camera,
    private readonly lib: SpriteLibrary,
    private readonly skins: SkinTextures,
  ) {
    this.room = new Room(lib, this.reelFrame);
    this.bench = new Bench(lib, skins, controller, (c) => {
      const tex = app.renderer.generateTexture({ target: c, resolution: 1 });
      tex.source.scaleMode = "nearest";
      return tex;
    });
    this.reel = new Reel(this.reelFrame, skins, () => audio.play("reel-tick", { rate: comboPitch(controller.run.state.combo) }));
    this.hd = new HdLayer(lib.get("coin", { w: 12, h: 22, frames: 4 }).frames);
    this.knifeFlight = new KnifeFlight(this.hd.root);
    this.pixel.world.addChild(this.room.back, this.room.front, this.reel, this.bench.root);
    this.hd.root.addChild(this.hint, ...this.label, this.offline, this.lifted.root);
    for (const txt of [this.hint, ...this.label, this.offline]) txt.anchor.set(0.5, 0);
    this.scene.addChild(this.pixel.view, this.hd.root);
    this.look = new StageLook(this.scene);
    app.stage.addChild(this.scene, this.hd.overlay);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e: FederatedPointerEvent) => void this.bench.pointerDown(this.worldPt(e)));
    app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.bench.pointerMove(this.worldPt(e));
    });
    app.stage.on("pointerup", (e: FederatedPointerEvent) => this.bench.pointerUp(this.worldPt(e)));
    app.stage.on("pointerupoutside", (e: FederatedPointerEvent) => this.bench.pointerUp(this.worldPt(e)));
    this.off = controller.onEvent((e) => this.onEvent(e));

    this.vp = pixelViewport(app.screen.width, app.screen.height);
    this.l = tableLayout(this.vp);
    this.applyLayout();
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.restore();
  }

  /** Redraw a run already in progress (the scene is rebuilt after a trip to the lobby). */
  private restore(): void {
    const plan = restorePlan(this.controller.run.state);
    if (plan.caseId) this.bench.showCase(plan.caseId, false);
    if (plan.spinning) {
      const b = this.controller.run.state.bench;
      this.reel.start(caseById(plan.spinning.caseId), skinById(plan.spinning.skinId), this.rng, b.phase === "spinning" ? b.tease : null);
      this.bench.openCase();
    }
    if (plan.revealed) {
      this.bench.showReveal(skinById(plan.revealed.skinId), plan.revealed);
      this.hd.setGlow(RARITY_INFO[plan.revealed.rarity].color);
    }
    this.look.setStage(plan.stage);
    this.audio.setStage(plan.stage);
    this.lastStage = plan.stage;
  }

  /** Real seconds → this frame's game-time scale (0 during hit-stop, <1 in slow-mo). */
  timeScale(realSeconds: number): number {
    return this.time.update(realSeconds);
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.screen.w || height !== this.screen.h) {
      this.bench.cancelDrag(); // Review Focus 3: a resize or rotation mid-drag cancels it
      this.vp = pixelViewport(width, height);
      this.l = tableLayout(this.vp);
      this.applyLayout();
    }
    const gameMs = realSeconds * scale * 1000;
    const run = this.controller.run;
    const b = run.state.bench;
    const crawl = b.phase === "spinning" ? crawlSeconds(b.tease, b.fullDuration) : 0;
    this.reel.update(b.phase === "spinning" ? { elapsed: b.elapsed, fullDuration: b.fullDuration, crawl } : null);
    if (b.phase === "spinning" && b.tease && !this.leaned && b.elapsed >= b.fullDuration - crawl) {
      this.leaned = true; // a red or a knife is crawling in (or a fake one): lean in toward the reel
      this.zoom.punch(1 + TEASE_ZOOM * b.tease.strength, b.fullDuration - b.elapsed);
    }
    this.bench.update(gameMs, b);
    this.room.update(realSeconds * 1000);
    this.hd.update(realSeconds);
    this.look.update(realSeconds);
    setTweenTimeScale(scale);
    this.updateText(b);
    this.hd.setBinCalling(b.phase === "revealed");

    const k = this.vp.scale;
    this.lifted.update(this.bench.lifted(), k, realSeconds);
    this.knifeFlight.update(realSeconds);
    // camera: shake in whole px, zoom around the reveal card
    const s = this.shake.update(realSeconds);
    const z = this.zoom.update(realSeconds);
    const r = this.l.you.reel;
    const target = this.screenPt(
      b.phase === "spinning" && this.leaned ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : this.bench.revealCentre(),
    );
    const glide = Math.min(1, realSeconds * 6);
    this.focus = this.focus
      ? { x: this.focus.x + (target.x - this.focus.x) * glide, y: this.focus.y + (target.y - this.focus.y) * glide }
      : target;
    const focus = this.focus;
    this.scene.pivot.set(focus.x, focus.y);
    this.scene.position.set(focus.x + Math.round(s.x * k), focus.y + Math.round(s.y * k));
    this.scene.scale.set(z);
    this.camera.set({ focusX: focus.x, focusY: focus.y, dx: Math.round(s.x * k), dy: Math.round(s.y * k), zoom: z }); // the UI overlay follows
    this.pixel.render(this.app.renderer);
  }

  destroy(): void {
    this.off();
    this.app.stage.removeAllListeners();
    this.hd.destroy();
    this.bench.destroy();
    this.pixel.destroy();
    this.scene.destroy({ children: true });
    this.skins.destroy();
    this.lib.destroy();
    this.reelFrame.frames[0]!.destroy(true);
  }

  /** Pointer → world px, through the camera (shake and zoom). Fractional, so lifted items glide. */
  private worldPt(e: FederatedPointerEvent): Pt {
    const p = this.pixel.view.toLocal(e.global);
    return { x: p.x, y: p.y };
  }

  private applyLayout(): void {
    // the screen changed: a knife in the air goes straight back into its card
    if (this.knifeFlight?.flying) {
      this.knifeFlight.cancel();
      this.bench.endKnifeFlight();
    }
    const { width, height } = this.app.screen;
    this.screen = { w: width, h: height };
    this.pixel.resize(this.vp);
    this.room.layout(this.l);
    this.bench.layout(this.l);
    this.reel.layout(this.l.you.reel);
    this.hd.layout(this.l, this.vp, width, height);
    const k = this.vp.scale;
    const size = hdFontSize(k);
    for (const txt of [this.hint, ...this.label, this.offline]) txt.style.fontSize = size;
    const r = this.l.you.reel;
    this.hint.position.set((r.x + r.w / 2) * k, (r.y + r.h + 2) * k);
    // The card's lines wrap to the table and slide along it rather than run under a side panel.
    const tb = this.l.table;
    for (const txt of this.label) Object.assign(txt.style, { wordWrap: true, wordWrapWidth: (tb.w - 4) * k, align: "center" });
    this.labelSpan = { lo: (tb.x + 2) * k, hi: (tb.x + tb.w - 2) * k };
    this.placeLabels();
    const br = this.l.bot.reel;
    this.offline.visible = !!br;
    if (br) this.offline.position.set((br.x + br.w / 2) * k, (br.y + br.h / 2) * k - size / 2);
  }

  /** Strings are rebuilt every frame from state, so a language switch shows at once (Review Focus 2). */
  private updateText(b: BenchState): void {
    const key = hintKey(b);
    const hint = key ? t(key) : "";
    if (this.hint.text !== hint) this.hint.text = hint;
    const lines = b.phase === "revealed" ? revealLines(b.drop) : ["", ""];
    lines.forEach((text, i) => {
      if (this.label[i]!.text !== text) this.label[i]!.text = text;
    });
    if (b.phase === "revealed") this.label[1]!.style.fill = RARITY_INFO[b.drop.rarity].color;
    this.placeLabels();
    const off = t("station.offline");
    if (this.offline.text !== off) this.offline.text = off;
  }

  private placeLabels(): void {
    const k = this.vp.scale;
    const card = this.l.you.reveal;
    const [a, b] = this.label as [Text, Text];
    const { lo, hi } = this.labelSpan;
    a.position.set(fitCentre(card.x * k, a.width, lo, hi), (card.y + 16) * k);
    b.position.set(fitCentre(card.x * k, b.width, lo, hi), a.y + a.height + k);
  }

  private screenPt(p: Pt): Pt {
    return this.hd.toScreen(p);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(e.caseId, true);
        this.audio.play("case-latch");
        break;
      case "spinStarted":
        this.bench.openCase();
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng, e.tease);
        this.leaned = false;
        this.audio.play("key-turn");
        this.audio.play("lid-creak", { delay: 0.12 });
        break;
      case "revealed":
        this.shake.add(0.12); // the reel lands
        this.audio.play("reel-stop", { gain: 0.6 });
        this.onReveal(e.drop);
        break;
      case "sold": {
        this.knifeFlight.cancel();
        const at = this.screenPt(this.bench.revealCentre());
        this.hd.coins.burst(at, { x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }, e.amount);
        this.hd.coins.floatText({ x: at.x, y: at.y - 10 * this.vp.scale }, `+${formatCash(e.amount, getLang())}`);
        this.hd.setGlow(null);
        this.audio.play("cash-register");
        this.audio.play("coin-clink", { rate: comboPitch(e.combo), delay: 0.05 });
        if (e.amount >= 100) this.audio.play("coin-cascade", { delay: 0.1 });
        this.bench.clearReveal(true);
        break;
      }
      case "stageChanged":
        this.look.setStage(e.stage);
        this.audio.setStage(e.stage);
        if (e.stage > this.lastStage) {
          this.shake.add(0.3);
          this.zoom.punch(1.06, 0.25);
          this.hd.flash(0xff7ad9, 0.35);
          this.audio.play("stage-whoosh");
        }
        this.lastStage = e.stage;
        break;
    }
  }

  private onReveal(d: Drop): void {
    const skin = skinById(d.skinId);
    this.bench.showReveal(skin, d);
    const at = this.screenPt(this.bench.revealCentre());
    const color = RARITY_INFO[d.rarity].color;
    const v = this.vp.scale / 6; // spark speeds were tuned at scale 6 (1080p)
    if (skin.motion?.weapon === "flip") this.launchKnife(skin, at, v);
    this.hd.setGlow(color);
    this.audio.play("reveal-chime", { rate: 2 ** (RARITY_ORDER.indexOf(d.rarity) / 6) });
    switch (d.rarity) {
      case "milspec":
        this.hd.particles.burst(at, color, 10, 140 * v);
        break;
      case "restricted":
        this.hd.particles.burst(at, color, 24, 220 * v);
        break;
      case "classified":
        this.hd.particles.burst(at, color, 45, 300 * v);
        this.shake.add(0.2);
        break;
      case "covert":
        this.time.hitStop(0.08);
        this.zoom.punch(1.1, 0.15);
        this.shake.add(0.55);
        this.audio.play("covert-impact");
        this.audio.duck(1.2);
        this.hd.particles.burst(at, color, 90, 420 * v);
        break;
      case "gold":
        this.time.slowMo(0.2, 2.2, 0.7);
        this.zoom.punch(1.3, 1.8);
        this.shake.add(0.8);
        this.hd.flash(0xffd700, 0.7);
        this.audio.play("jackpot-swell");
        this.audio.duck(2.6, 0.2);
        this.hd.particles.burst(at, color, 220, 520 * v);
        break;
    }
  }

  /** The ★ knife's b-roll shot: it comes out of the card toward the viewer, turns, and settles back in. */
  private launchKnife(skin: SkinDef, at: Pt, v: number): void {
    const k = this.vp.scale;
    this.bench.beginKnifeFlight();
    this.knifeFlight.start(this.skins.frames(skin)[0]!, at, k, () => {
      this.bench.endKnifeFlight();
      this.shake.add(0.3);
      this.audio.play("coin-clink", { rate: 0.75 });
      this.hd.particles.burst(at, 0xffd700, 50, 260 * v);
    });
  }
}
