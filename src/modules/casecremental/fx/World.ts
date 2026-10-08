import { Container, Text, type Application, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import { getLang, t } from "../i18n/index";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { Bench as BenchState, SimEvent } from "../sim/run";
import type { Drop } from "../sim/types";
import type { AudioEngine } from "./audio/AudioEngine";
import { comboPitch } from "./audio/schedule";
import { loadPixelFont, pixelStyle } from "./hd/font";
import { HdLayer } from "./hd/HdLayer";
import { setTweenTimeScale } from "./hd/tween";
import { Shake } from "./juice/shake";
import { StageLook } from "./juice/stageLook";
import { TimeScale } from "./juice/timeScale";
import { fitCentre, hintKey, revealLines } from "./labels";
import { Bench } from "./pixel/Bench";
import { tableLayout, type Pt, type TableLayout } from "./pixel/layout";
import { PixelLayer } from "./pixel/PixelLayer";
import { Reel } from "./pixel/Reel";
import { Room } from "./pixel/Room";
import { hdFontSize, toWorld } from "./pixel/screen";
import { spriteIndex, SpriteLibrary } from "./pixel/sprites";
import { pixelViewport, type PixelViewport } from "./pixel/viewport";
import { restorePlan } from "./restore";
import { loadWeaponBases, SkinTextures } from "./skins/pixelSkin";

// Everything drawn on the canvas (spec §2): the pixel world (room, table, your bench, the reel)
// rendered small and scaled up by a whole number, and the HD layer over it (light, dust, glow,
// sparks, coins, text). Sim events drive the juice: sparks, coins, sound, shake, hit-stop on
// Covert, slow-mo + flash on ★, and the look of the intensity stage.

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
  private readonly off: () => void;

  static async create(app: Application, controller: GameController, audio: AudioEngine): Promise<World> {
    await loadPixelFont();
    const lib = await SpriteLibrary.load();
    const bases = await loadWeaponBases(spriteIndex());
    return new World(app, controller, audio, lib, new SkinTextures(bases));
  }

  private constructor(
    private readonly app: Application,
    private readonly controller: GameController,
    private readonly audio: AudioEngine,
    private readonly lib: SpriteLibrary,
    private readonly skins: SkinTextures,
  ) {
    this.room = new Room(lib);
    this.bench = new Bench(lib, skins, controller);
    this.reel = new Reel(lib.get("reel-frame", { w: 48, h: 24 }), skins, () => audio.play("reel-tick", { rate: comboPitch(controller.run.state.combo) }));
    this.hd = new HdLayer(lib.get("coin", { w: 12, h: 22, frames: 4 }).frames);
    this.pixel.world.addChild(this.room.back, this.room.front, this.reel, this.bench.root);
    this.hd.root.addChild(this.hint, ...this.label, this.offline);
    for (const txt of [this.hint, ...this.label, this.offline]) txt.anchor.set(0.5, 0);
    this.scene.addChild(this.pixel.view, this.hd.root);
    this.look = new StageLook(this.scene);
    app.stage.addChild(this.scene);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e: FederatedPointerEvent) => void this.bench.pointerDown(this.worldPt(e)));
    app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.bench.pointerMove(this.worldPt(e));
      this.room.parallax(Math.min(1, Math.max(0, e.global.x / Math.max(1, this.screen.w))));
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
      this.reel.start(caseById(plan.spinning.caseId), skinById(plan.spinning.skinId), this.rng);
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
    this.reel.update(b.phase === "spinning" ? b : null);
    this.bench.update(gameMs, b);
    this.room.update(realSeconds * 1000);
    this.hd.update(realSeconds);
    this.look.update(realSeconds);
    setTweenTimeScale(scale);
    this.updateText(b, run.canBrake());

    const k = this.vp.scale;
    const s = this.shake.update(realSeconds);
    this.pixel.setOffset(s.x * k, s.y * k);
    this.hd.root.position.set(Math.round(s.x * k), Math.round(s.y * k));
    this.pixel.render(this.app.renderer);
  }

  destroy(): void {
    this.off();
    this.app.stage.removeAllListeners();
    this.hd.destroy();
    this.pixel.destroy();
    this.scene.destroy({ children: true });
    this.skins.destroy();
    this.lib.destroy();
  }

  private worldPt(e: FederatedPointerEvent): Pt {
    return toWorld(this.vp, e.global.x, e.global.y);
  }

  private applyLayout(): void {
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
  private updateText(b: BenchState, canBrake: boolean): void {
    const key = hintKey(b, canBrake);
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
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        this.audio.play("key-turn");
        this.audio.play("lid-creak", { delay: 0.12 });
        break;
      case "braked":
        this.shake.add(0.12);
        this.audio.play("brake-thud", { gain: 0.6 });
        break;
      case "revealed":
        this.onReveal(e.drop);
        break;
      case "sold": {
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
          this.hd.flash(0xff7ad9, 0.35);
          this.audio.play("stage-whoosh");
        }
        this.lastStage = e.stage;
        break;
    }
  }

  private onReveal(d: Drop): void {
    this.bench.showReveal(skinById(d.skinId), d);
    const at = this.screenPt(this.bench.revealCentre());
    const color = RARITY_INFO[d.rarity].color;
    const v = this.vp.scale / 6; // spark speeds were tuned at scale 6 (1080p)
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
        this.shake.add(0.55);
        this.audio.play("covert-impact");
        this.audio.duck(1.2);
        this.hd.particles.burst(at, color, 90, 420 * v);
        break;
      case "gold":
        this.time.slowMo(0.2, 2.2, 0.7);
        this.shake.add(0.8);
        this.hd.flash(0xffd700, 0.7);
        this.audio.play("jackpot-swell");
        this.audio.duck(2.6, 0.2);
        this.hd.particles.burst(at, color, 220, 520 * v);
        break;
    }
  }
}
