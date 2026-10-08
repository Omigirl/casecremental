import { Container, Text, type Application, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import type { Camera } from "./camera";
import { getLang, t } from "../i18n/index";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { Bench as BenchState, RunState, SimEvent } from "../sim/run";
import { VAULT_LAND_TIMES } from "../sim/tuning";
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
import { fitCentre, hintKey, revealLines, trayFull } from "./labels";
import { Bench } from "./pixel/Bench";
import { BotCardView } from "./pixel/BotCard";
import { BotSprite } from "./pixel/BotSprite";
import { reelFrameSet } from "./pixel/drawn";
import { tableLayout, type Pt, type TableLayout } from "./pixel/layout";
import { PixelLayer } from "./pixel/PixelLayer";
import { Reel } from "./pixel/Reel";
import { Room } from "./pixel/Room";
import { scaleTint } from "./pixel/tint";
import { TrayView } from "./pixel/Tray";
import { hdFontSize } from "./pixel/screen";
import { spriteIndex, SpriteLibrary } from "./pixel/sprites";
import { pixelViewport, type PixelViewport } from "./pixel/viewport";
import { restorePlan } from "./restore";
import { crawlSeconds } from "./reel/motion";
import { loadWeaponBases, SkinTextures } from "./skins/pixelSkin";
import { VAULT_CUE_TIMES } from "./vault/cues";
import { StackedReels, stackRects } from "./vault/stackedReels";
import { applyMusic, musicPlan, PowerCycle } from "./vault/vaultFlow";
import { vaultReelArea, VaultScene } from "./vault/VaultScene";

// Everything drawn on the canvas (spec §2): the pixel world (room, table, your bench, the reel)
// rendered small and scaled up by a whole number, and the HD layer over it (light, dust, glow,
// sparks, coins, text). Sim events drive the juice: sparks, coins, sound, shake, hit-stop and a
// zoom punch on Covert, slow-mo + push-in + flash on ★, and the look of the intensity stage. The
// camera (shake + zoom) moves the whole scene around the reveal; vignette and flash stay put.

/** How far a full-strength tease leans the camera in (a ★ in the top case: 1.15×). */
const TEASE_ZOOM = 0.15;
/** A hands-off click's sparks (the prestige screen's dark). */
const SPARK_COLORS = [0xff7ad9, 0x7affc1, 0xffd34d, 0x6ab0ff] as const;

export class World {
  private readonly scene = new Container();
  private readonly pixel = new PixelLayer();
  private readonly hd: HdLayer;
  private readonly room: Room;
  private readonly bench: Bench;
  private readonly reel: Reel;
  private readonly bot: BotSprite;
  private readonly botReel: Reel;
  private readonly botCard: BotCardView;
  private readonly tray: TrayView;
  private readonly look: StageLook;
  private readonly shake = new Shake(Math.random, 3);
  private readonly time = new TimeScale();
  private readonly zoom = new Zoom();
  private readonly lifted = new Lifted();
  private knifeFlight!: KnifeFlight;
  /** Vault Case I's scene over everything (screen px), its five reels in a pixel layer of their own inside it. */
  private readonly vault: VaultScene;
  private readonly vaultPixel = new PixelLayer();
  private readonly vaultReels: StackedReels;
  private readonly power: PowerCycle;
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xc8cbd6) });
  private readonly label = [new Text({ text: "", style: pixelStyle(8, 0xffffff) }), new Text({ text: "", style: pixelStyle(8, 0xffffff) })];
  private labelSpan = { lo: 0, hi: 0 };
  private readonly offline = new Text({ text: "", style: pixelStyle(8, 0x6a6f80) });
  private readonly trayFullLabel = new Text({ text: "", style: pixelStyle(8, 0xffb020) });
  private trayBlink = 0;
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
    const bake = (c: Container) => {
      const tex = app.renderer.generateTexture({ target: c, resolution: 1 });
      tex.source.scaleMode = "nearest";
      return tex;
    };
    this.bench = new Bench(lib, skins, controller, bake);
    this.tray = new TrayView(skins, controller, bake);
    this.reel = new Reel(this.reelFrame, skins, () => audio.play("reel-tick", { rate: comboPitch(controller.run.state.combo) }));
    this.botReel = new Reel(this.reelFrame, skins, () => audio.play("reel-tick", { gain: 0.35, rate: 1.2 }));
    this.bot = new BotSprite(lib);
    this.botCard = new BotCardView(skins, controller, bake);
    this.hd = new HdLayer(lib.get("coin", { w: 12, h: 22, frames: 4 }).frames);
    this.knifeFlight = new KnifeFlight(this.hd.root);
    this.pixel.world.addChild(
      this.room.back,
      this.room.front,
      this.tray.root,
      this.reel,
      this.botReel,
      this.bench.root,
      this.bot.root,
      this.botCard.root,
    );
    this.hd.root.addChild(this.hint, ...this.label, this.offline, this.trayFullLabel, this.lifted.root);
    for (const txt of [this.hint, ...this.label, this.offline]) txt.anchor.set(0.5, 0);
    this.trayFullLabel.anchor.set(0.5, 1);
    this.trayFullLabel.visible = false;
    this.scene.addChild(this.pixel.view, this.hd.root);
    this.look = new StageLook(this.scene);
    this.vault = new VaultScene(lib, this.hd, audio, (trauma) => this.shake.add(trauma));
    this.vaultReels = new StackedReels(this.reelFrame, skins, (i) => audio.play("reel-tick", { gain: 0.3, rate: 1 + i * 0.1 }));
    this.vaultPixel.world.addChild(this.vaultReels);
    this.vaultReels.visible = false;
    this.vault.reelSlot.addChild(this.vaultPixel.view);
    this.power = new PowerCycle(audio);
    app.stage.addChild(this.scene, this.vault.root, this.hd.overlay);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e: FederatedPointerEvent) => this.pointerDown(e));
    app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.vault.keyMove(e.global);
      const p = this.worldPt(e);
      this.tray.pointerMove(p);
      this.botCard.pointerMove(p);
      this.bench.pointerMove(p);
    });
    const up = (e: FederatedPointerEvent) => {
      if (this.vault.keyRelease(e.global) === "turn") void this.controller.act({ type: "turnVaultKey" });
      const p = this.worldPt(e);
      this.tray.pointerUp(p);
      this.botCard.pointerUp(p);
      this.bench.pointerUp(p);
    };
    app.stage.on("pointerup", up);
    app.stage.on("pointerupoutside", up);
    this.off = controller.onEvent((e) => this.onEvent(e));

    this.vp = pixelViewport(app.screen.width, app.screen.height);
    this.l = tableLayout(this.vp);
    this.applyLayout();
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.botReel.start(first, this.rng.pick(first.skins), this.rng);
    this.restore();
  }

  /** Redraw a run already in progress (the scene is rebuilt after a trip to the lobby). */
  private restore(): void {
    const sp = this.controller.run.state.bot.spin;
    if (sp) this.botReel.start(caseById(sp.caseId), skinById(sp.drop.skinId), this.rng);
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
    this.restoreVault(this.controller.run.state);
  }

  /** A reload with the vault out waits for the key again, resumes the opening where it is, or sits in the dark
   *  of the prestige screen. */
  private restoreVault(s: RunState): void {
    const v = s.vault;
    if (v?.phase === "key") this.audio.setTrack("vault-suspense", { loop: true });
    else if (v?.phase === "opening") {
      this.startVaultReels(v.drops);
      this.audio.setTrack("vault-fanfare", { loop: false, offset: v.t });
    } else if (s.over) this.power.darkNow();
  }

  private startVaultReels(drops: readonly Drop[]): void {
    // never caseById on a vault drop (its case is "vault1"): the strips are the top case's skins
    const top = caseById("bedrock");
    drops.forEach((d, i) => this.vaultReels.start(i, top, skinById(d.skinId), this.rng));
    this.vaultReels.visible = true;
  }

  /** Back from the lobby: the music picks up where the vault (or the power-up) is, not where it was asked for. */
  resumeMusic(): void {
    applyMusic(this.audio, musicPlan(this.controller.run.state, this.power.poweringUp));
  }

  /** Real seconds → this frame's game-time scale (0 during hit-stop, <1 in slow-mo). */
  timeScale(realSeconds: number): number {
    return this.time.update(realSeconds);
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.screen.w || height !== this.screen.h) {
      this.bench.cancelDrag(); // Review Focus 3: a resize or rotation mid-drag cancels it
      this.tray.cancelDrag();
      this.botCard.cancelDrag();
      this.vault.cancelDrag();
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
    const bot = run.state.bot;
    this.bot.update(gameMs, bot);
    const spin = bot.spin;
    this.botReel.update(spin ? { elapsed: spin.elapsed, fullDuration: spin.duration, crawl: 0 } : null);
    this.botCard.update(bot.card);
    this.room.setBotOnline(bot.awake);
    this.botReel.visible = !!this.l.bot.reel && bot.awake;
    this.offline.visible = !!this.l.bot.reel && !bot.awake;
    this.hd.setBotAsleep(!bot.awake);
    this.tray.update(run.state.tray, run.setup.trayCapacity);
    this.trayBlink += realSeconds;
    this.trayFullLabel.visible = trayFull(run.state, run.setup.trayCapacity) && Math.floor(this.trayBlink * 4) % 2 === 0; // ~2 Hz
    this.room.setSellerOn(run.state.seller.on);
    this.hd.setSellerOn(run.state.seller.on);
    this.room.update(realSeconds * 1000);
    this.updateVault(realSeconds);
    this.hd.update(realSeconds);
    this.look.update(realSeconds);
    setTweenTimeScale(scale);
    this.updateText(b);
    this.hd.setBinCalling(b.phase === "revealed");

    const k = this.vp.scale;
    this.lifted.update(this.tray.lifted() ?? this.botCard.lifted() ?? this.bench.lifted(), k, realSeconds);
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
    this.vault.root.position.set(Math.round(s.x * k), Math.round(s.y * k)); // the vault shakes too, but never zooms
    this.pixel.render(this.app.renderer);
    if (this.vaultReels.visible) this.vaultPixel.render(this.app.renderer, true);
  }

  destroy(): void {
    this.tray.cancelDrag(); // a drag left mid-air would leave the card "held" across a lobby trip
    this.botCard.cancelDrag();
    this.bench.cancelDrag();
    this.vault.cancelDrag();
    this.off();
    this.app.stage.removeAllListeners();
    this.hd.destroy();
    this.bench.destroy();
    this.tray.destroy();
    this.botCard.destroy();
    this.pixel.destroy();
    this.vaultPixel.destroy();
    this.vault.destroy();
    this.scene.destroy({ children: true });
    this.skins.destroy();
    this.lib.destroy();
    this.reelFrame.frames[0]!.destroy(true);
  }

  private pointerDown(e: FederatedPointerEvent): void {
    const run = this.controller.run;
    if (run.locked()) {
      // the vault's key is the one thing to grab; anywhere else (and over the opening) a click only adds sparks
      if (run.state.vault?.phase === "key" && this.vault.keyHit(e.global)) return;
      if (run.state.vault) this.vault.sparks(e.global);
      else {
        const at = this.hd.root.toLocal(e.global);
        this.hd.particles.burst({ x: at.x, y: at.y }, this.rng.pick(SPARK_COLORS), 14, 220 * (this.vp.scale / 6));
      }
      return;
    }
    const p = this.worldPt(e);
    if (!this.tray.pointerDown(p) && !this.botCard.pointerDown(p)) void this.bench.pointerDown(p);
  }

  /** The vault, read from the sim each frame (a reload picks it up where it is), and the lights. */
  private updateVault(realSeconds: number): void {
    const s = this.controller.run.state;
    const v = s.vault;
    const opening = v?.phase === "opening" ? v : null;
    this.vault.show(v?.phase ?? (s.over ? "done" : null), opening?.t ?? 0, opening?.drops ?? [], opening?.landed ?? 0);
    if (opening) {
      // each reel spins from the moment they come in until its landing time, then stays landed
      for (let i = 0; i < VAULT_LAND_TIMES.length; i++) {
        const fullDuration = VAULT_LAND_TIMES[i]! - VAULT_CUE_TIMES.reels;
        const elapsed = Math.min(fullDuration, Math.max(0, opening.t - VAULT_CUE_TIMES.reels));
        this.vaultReels.update(i, { elapsed, fullDuration, crawl: i === VAULT_LAND_TIMES.length - 1 ? 2.5 : 0.8 });
      }
    }
    this.vault.update(realSeconds);
    const lights = this.power.update(realSeconds);
    this.hd.setLights(lights);
    this.room.setLight(lights.room);
    const reels = scaleTint(0xffffff, lights.reels);
    this.reel.tint = reels;
    this.botReel.tint = reels;
    this.vaultReels.tint = reels;
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
    this.bot.layout(this.l);
    this.tray.layout(this.l);
    this.reel.layout(this.l.you.reel);
    if (this.l.bot.reel) this.botReel.layout(this.l.bot.reel);
    this.botCard.layout(this.l);
    this.hd.layout(this.l, this.vp, width, height);
    this.vaultPixel.resize(this.vp);
    this.vaultReels.layout(stackRects(vaultReelArea(this.l), VAULT_LAND_TIMES.length));
    this.vault.layout(this.screen, this.l, this.vp.scale);
    const k = this.vp.scale;
    const size = hdFontSize(k);
    for (const txt of [this.hint, ...this.label, this.offline, this.trayFullLabel]) txt.style.fontSize = size;
    const r = this.l.you.reel;
    this.hint.position.set((r.x + r.w / 2) * k, (r.y + r.h + 2) * k);
    // The card's lines wrap to the table and slide along it rather than run under a side panel.
    const tb = this.l.table;
    for (const txt of this.label) Object.assign(txt.style, { wordWrap: true, wordWrapWidth: (tb.w - 4) * k, align: "center" });
    this.labelSpan = { lo: (tb.x + 2) * k, hi: (tb.x + tb.w - 2) * k };
    this.placeLabels();
    const tr = this.l.tray;
    this.trayFullLabel.position.set((tr.x + tr.w / 2) * k, (tr.y - 1) * k);
    const br = this.l.bot.reel;
    if (br) this.offline.position.set((br.x + br.w / 2) * k, (br.y + br.h / 2) * k - size / 2);
  }

  /** Strings are rebuilt every frame from state, so a language switch shows at once (Review Focus 2). */
  private updateText(b: BenchState): void {
    const key = this.controller.run.locked() ? null : hintKey(b); // no "Buy a case" during the finale or after the run
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
    const full = t("float.trayfull");
    if (this.trayFullLabel.text !== full) this.trayFullLabel.text = full;
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
        // only a bench sale clears the card; the bot's and the tray's sales burst coins from the bin
        const fromBench = e.from === "bench";
        const src =
          fromBench && e.source === "bench"
            ? this.bench.revealCentre()
            : e.source === "bot"
              ? this.botCard.centre()
              : e.source === "seller"
                ? this.l.seller
                : this.l.bin;
        const at = this.screenPt(src);
        if (fromBench) this.knifeFlight.cancel();
        this.hd.coins.burst(at, { x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }, e.amount);
        this.hd.coins.floatText({ x: at.x, y: at.y - 10 * this.vp.scale }, `+${formatCash(e.amount, getLang())}`);
        if (fromBench) this.hd.setGlow(null);
        this.audio.play(e.source === "seller" ? "seller-sell" : "cash-register");
        this.audio.play("coin-clink", { rate: comboPitch(e.combo), delay: 0.05 });
        if (e.amount >= 100) this.audio.play("coin-cascade", { delay: 0.1 });
        if (fromBench) this.bench.clearReveal(e.source === "bench"); // a machine sale just clears the card
        if (e.source === "tray" || e.source === "bot") this.bench.swallow();
        break;
      }
      case "botWoke":
        this.bot.wake();
        this.hd.flash(0xffd28a, 0.15); // the station's lamp flickers on
        this.audio.play("bot-wake");
        break;
      case "sellerBought":
        this.hd.flash(0x3ddc84, 0.2);
        this.audio.play("seller-power-on");
        break;
      case "sellerUpgraded":
        this.audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "dayJobStarted":
        this.audio.play("dayjob-work");
        break;
      case "botUpgraded":
        this.audio.play("bot-servo", { rate: 1.2 });
        break;
      case "botSpinStarted":
        this.bot.open();
        this.botReel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        this.audio.play("bot-reel-spin");
        break;
      case "botRevealed": {
        const at = this.screenPt(this.botCard.centre());
        this.hd.particles.burst(at, RARITY_INFO[e.drop.rarity].color, 18, 160 * (this.vp.scale / 6));
        this.audio.play("reveal-chime", { gain: 0.5, rate: 2 ** (RARITY_ORDER.indexOf(e.drop.rarity) / 6) });
        break;
      }
      case "dayJobDone": {
        const tb = this.l.table;
        const at = this.screenPt({ x: tb.x + tb.w / 2, y: tb.y + 12 });
        this.hd.coins.floatText(at, e.amount > 0 ? `+${formatCash(e.amount, getLang())}` : t("float.nopay"));
        this.audio.play(e.amount > 0 ? "dayjob-pay" : "dayjob-nopay");
        break;
      }
      case "stored":
        if (e.from === "bench") {
          this.knifeFlight.cancel();
          this.bench.clearReveal(false);
          this.hd.setGlow(null);
        }
        this.audio.play("tray-store");
        break;
      case "vaultBought":
        // the screen goes to the vault: it slams in, the suspense loop takes over the music
        this.bench.cancelDrag();
        this.tray.cancelDrag();
        this.botCard.cancelDrag();
        this.knifeFlight.cancel();
        this.vault.slam();
        this.audio.setTrack("vault-suspense", { loop: true });
        break;
      case "vaultKeyTurned":
        this.startVaultReels(e.drops);
        this.audio.setTrack("vault-fanfare", { loop: false });
        break;
      case "vaultReelLanded":
        this.onVaultReelLanded(e.index, e.drop, e.amount);
        break;
      case "vaultOpened":
        this.power.blackout();
        break;
      case "charmPicked":
        this.audio.play("charm-pick");
        break;
      case "perkBought":
        this.audio.play("perk-buy");
        break;
      case "runStarted":
        this.bench.cancelDrag();
        this.tray.cancelDrag();
        this.botCard.cancelDrag();
        this.knifeFlight.cancel();
        this.bench.clearReveal(false);
        this.bench.hideCase();
        this.hd.setGlow(null);
        this.vaultReels.visible = false;
        this.power.powerUp(); // before restore(): the stage loop waits for the lights
        this.restore(); // the fresh run's stage 1, look and music
        break;
      case "stageChanged":
        this.look.setStage(e.stage);
        this.audio.setStage(e.stage);
        if (e.stage > this.lastStage) {
          this.shake.add(0.3);
          this.zoom.punch(1.06, 0.25);
          this.hd.flash(0xff7ad9, 0.35);
          this.audio.play("stage-up");
        }
        this.lastStage = e.stage;
        break;
    }
  }

  /** A vault reel lands (and pays): each one louder than the last; the fifth is the legendary, shown with the
   *  knife's b-roll showcase, its animated texture playing as it turns. */
  private onVaultReelLanded(index: number, d: Drop, amount: number): void {
    const k = this.vp.scale;
    const r = stackRects(vaultReelArea(this.l), VAULT_LAND_TIMES.length)[index];
    if (!r) return;
    const at = { x: (r.x + r.w / 2) * k, y: (r.y + r.h / 2) * k };
    const last = index === VAULT_LAND_TIMES.length - 1;
    const color = RARITY_INFO[d.rarity].color;
    this.audio.play("vault-reel-land", { rate: 1 + index * 0.08 });
    this.audio.play("firework", { gain: 0.6, rate: 1.1 + index * 0.05, delay: 0.05 });
    this.vault.firework(at, color, last);
    this.vault.floatText({ x: at.x, y: at.y - r.h * k * 0.6 }, `+${formatCash(amount, getLang())}`);
    this.shake.add(0.25 + index * 0.08);
    if (!last) return;
    this.audio.play("legendary-choir");
    this.hd.flash(0xffd700, 0.9);
    const skin = skinById(d.skinId); // VAULT_LEGEND (never caseById on it)
    this.vault.showcase(
      this.skins.frames(skin),
      at,
      k,
      () => {
        this.shake.add(0.3);
        this.audio.play("coin-clink", { rate: 0.75 });
        this.vault.firework(at, 0xffd700, true);
      },
      skin.motion?.fps ?? 8,
    );
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
