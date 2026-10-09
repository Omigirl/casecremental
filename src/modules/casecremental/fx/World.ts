import { Container, Text, type Application, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import type { Camera } from "./camera";
import { getLang, t } from "../i18n/index";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { Bench as BenchState, RunState, SimEvent } from "../sim/run";
import type { AudioEngine } from "./audio/AudioEngine";
import { comboPitch } from "./audio/schedule";
import { BenchFx } from "./benchFx";
import { loadPixelFont, pixelStyle } from "./hd/font";
import { HdLayer } from "./hd/HdLayer";
import { setTweenTimeScale } from "./hd/tween";
import { Lifted } from "./hd/Lifted";
import { Shake } from "./juice/shake";
import { StageLook } from "./juice/stageLook";
import { TimeScale } from "./juice/timeScale";
import { Zoom } from "./juice/zoom";
import { binCalling, fitCentre, hintKey, revealLines, trayFull } from "./labels";
import { Bench } from "./pixel/Bench";
import { bestSlot } from "./pixel/BenchCards";
import { BenchReels } from "./pixel/BenchReels";
import { BotCardView } from "./pixel/BotCard";
import { BotSprite } from "./pixel/BotSprite";
import { onPointerCancel } from "./pixel/drag";
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
import { loadWeaponBases, SkinTextures } from "./skins/pixelSkin";
import { applyMusic, bindMusicResync, musicPlan, PowerCycle } from "./vault/vaultFlow";
import { VaultBeams } from "./vault/VaultBeams";
import { VaultScene } from "./vault/VaultScene";

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
  /** Your bench's reels (multi-open stacks them) and its cards' reveal and sale juice. */
  private readonly benchReels: BenchReels;
  private readonly benchFx: BenchFx;
  private readonly bot: BotSprite;
  private readonly botReel: Reel;
  private readonly botCard: BotCardView;
  private readonly tray: TrayView;
  private readonly look: StageLook;
  private readonly shake = new Shake(Math.random, 3);
  private readonly time = new TimeScale();
  private readonly zoom = new Zoom();
  private readonly lifted = new Lifted();
  /** Vault Case I's scene over everything (screen px), its five reels as beams in its layers. */
  private readonly vault: VaultScene;
  private readonly vaultBeams: VaultBeams;
  private readonly power: PowerCycle;
  private readonly unbindMusic: () => void;
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xc8cbd6) });
  private readonly label = [new Text({ text: "", style: pixelStyle(8, 0xffffff) }), new Text({ text: "", style: pixelStyle(8, 0xffffff) })];
  private labelSpan = { lo: 0, hi: 0 };
  /** The card the label lines sit under (the best one waiting). */
  private labelAt: Pt = { x: 0, y: 0 };
  private readonly offline = new Text({ text: "", style: pixelStyle(8, 0x6a6f80) });
  private readonly trayFullLabel = new Text({ text: "", style: pixelStyle(8, 0xffb020) });
  private trayBlink = 0;
  private vp: PixelViewport;
  private l: TableLayout;
  private screen = { w: 0, h: 0 };
  private lastStage = 1;
  /** The reel windows are drawn in code (no art). */
  private readonly reelFrame = reelFrameSet();
  /** Where the camera pushes in, gliding between the reel (during a tease) and the reveal cards. */
  private focus: Pt | null = null;
  private readonly offs: (() => void)[] = [];

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
    // the other reels tick more quietly, so two reels never sound like a doubled click
    this.benchReels = new BenchReels(this.reelFrame, skins, (i) =>
      audio.play("reel-tick", { rate: comboPitch(controller.run.state.combo), gain: i === 0 ? 1 : 0.5 }),
    );
    this.botReel = new Reel(this.reelFrame, skins, () => audio.play("reel-tick", { gain: 0.35, rate: 1.2 }));
    this.bot = new BotSprite(lib);
    this.botCard = new BotCardView(skins, controller, bake);
    this.hd = new HdLayer(lib.get("coin", { w: 12, h: 22, frames: 4 }).frames);
    const juice = { hd: this.hd, audio, shake: this.shake, zoom: this.zoom, time: this.time };
    this.benchFx = new BenchFx(this.bench, juice, skins, () => this.vp.scale, this.hd.root);
    this.pixel.world.addChild(
      this.room.back,
      this.room.front,
      this.tray.root,
      this.benchReels.root,
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
    this.vault = new VaultScene(lib, this.hd, audio, this.shake, () => this.resumeMusic());
    this.vaultBeams = new VaultBeams(skins, this.vault, juice, this.rng);
    this.power = new PowerCycle(audio);
    this.unbindMusic = bindMusicResync(
      audio,
      document,
      () => controller.running,
      () => this.resumeMusic(),
    );
    app.stage.addChild(this.scene, this.vault.root, this.hd.overlay);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e: FederatedPointerEvent) => this.pointerDown(e));
    app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      this.vault.keyMove(e.global, e.pointerId);
      const p = this.worldPt(e);
      this.tray.pointerMove(p);
      this.botCard.pointerMove(p);
      this.bench.pointerMove(p);
    });
    const up = (e: FederatedPointerEvent) => {
      if (this.vault.keyRelease(e.global, e.pointerId) === "turn") void this.controller.act({ type: "turnVaultKey" });
      const p = this.worldPt(e);
      this.tray.pointerUp(p);
      this.botCard.pointerUp(p);
      this.bench.pointerUp(p);
    };
    app.stage.on("pointerup", up);
    app.stage.on("pointerupoutside", up);
    this.offs.push(controller.onEvent((e) => this.onEvent(e)));
    this.offs.push(onPointerCancel(app.canvas, (id) => this.cancelDrags(id)));

    this.vp = pixelViewport(app.screen.width, app.screen.height);
    this.l = tableLayout(this.vp);
    this.applyLayout();
    const first = caseById("bootcamp");
    this.benchReels.idle(first, this.rng.pick(first.skins), this.rng);
    this.botReel.start(first, this.rng.pick(first.skins), this.rng);
    this.restore();
  }

  /** Redraw a run already in progress (the scene is rebuilt after a trip to the lobby). */
  private restore(): void {
    const plan = restorePlan(this.controller.run.state);
    const br = plan.botReel; // its spin under way, or stopped on the drop its waiting card shows
    if (br) this.botReel.start(caseById(br.caseId), skinById(br.skinId), this.rng, null, br.landed);
    if (plan.caseId) this.bench.showCase(plan.caseId, false);
    if (plan.caseId && plan.spinning) {
      this.benchReels.start(plan.caseId, plan.spinning, this.rng);
      this.bench.openCase();
    }
    if (plan.revealed) this.benchFx.restore(plan.revealed);
    this.look.setStage(plan.stage);
    this.audio.setStage(plan.stage);
    this.lastStage = plan.stage;
    this.restoreVault(this.controller.run.state);
  }

  /** A reload or a new run: the vault's key or opening where the sim is, or the dark; the music always from the
   *  sim, so a stale track goes (while suspended, activate() applies it). */
  private restoreVault(s: RunState): void {
    const v = s.vault;
    if (v?.phase === "opening") this.vaultBeams.restore(v.drops, v.landed);
    if (!v && s.over) this.power.darkNow();
    if (this.controller.running) this.resumeMusic();
  }

  /** Back from the lobby: the music picks up where the vault (or the lights) are, not where it was asked for. */
  resumeMusic(): void {
    applyMusic(this.audio, musicPlan(this.controller.run.state, this.power.phase));
  }

  /** Real seconds → this frame's game-time scale (0 during hit-stop, <1 in slow-mo). */
  timeScale(realSeconds: number): number {
    return this.time.update(realSeconds);
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.screen.w || height !== this.screen.h) {
      this.cancelDrags(); // Review Focus 3: a resize or rotation mid-drag cancels it
      this.vp = pixelViewport(width, height);
      this.l = tableLayout(this.vp);
      this.applyLayout();
    }
    const gameMs = realSeconds * scale * 1000;
    const run = this.controller.run;
    const b = run.state.bench;
    const reels = this.benchReels.update(b); // a red or a knife is crawling in (or a fake one): lean in toward its reel
    if (reels.lean) this.zoom.punch(1 + TEASE_ZOOM * reels.lean.strength, reels.lean.seconds);
    if (reels.landed.length) this.benchFx.reelLanded(); // a reel that lands before its teasing partner stops on its own
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
    this.hd.setBinCalling(binCalling(run.state));

    const k = this.vp.scale;
    this.lifted.update(this.tray.lifted() ?? this.botCard.lifted() ?? this.bench.lifted(), k, realSeconds);
    this.benchFx.update(realSeconds);
    // camera: shake in whole px, zoom around the reveal cards
    const s = this.shake.update(realSeconds);
    const z = this.zoom.update(realSeconds);
    const target = this.hd.toScreen(this.benchReels.leanCentre() ?? this.bench.revealCentre());
    const glide = Math.min(1, realSeconds * 6);
    this.focus = this.focus
      ? { x: this.focus.x + (target.x - this.focus.x) * glide, y: this.focus.y + (target.y - this.focus.y) * glide }
      : target;
    const focus = this.focus;
    this.scene.pivot.set(focus.x, focus.y);
    this.scene.position.set(focus.x + Math.round(s.x * k) + this.vault.room.x, focus.y + Math.round(s.y * k) + this.vault.room.y);
    this.scene.scale.set(z * this.vault.room.zoom); // the room behind the vault pulses to its bar (the HUD does not)
    this.camera.set({ focusX: focus.x, focusY: focus.y, dx: Math.round(s.x * k), dy: Math.round(s.y * k), zoom: z }); // the UI overlay follows
    this.vault.root.position.set(Math.round(s.x * k), Math.round(s.y * k)); // the vault shakes too, but never zooms
    this.pixel.render(this.app.renderer);
  }

  destroy(): void {
    this.unbindMusic();
    this.cancelDrags(); // a drag left mid-air would leave the card "held" across a lobby trip
    for (const off of this.offs) off();
    this.app.stage.removeAllListeners();
    this.hd.destroy();
    this.bench.destroy();
    this.tray.destroy();
    this.botCard.destroy();
    this.pixel.destroy();
    this.vaultBeams.destroy();
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
      if (run.state.vault?.phase === "key" && this.vault.keyHit(e.global, e.pointerId)) return;
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
      this.vaultBeams.pulse(this.vault.cues.pulse); // this frame's cues, computed once (in show)
      this.vaultBeams.update(opening.t, this.vault.cues);
    }
    this.vault.update(realSeconds);
    const lights = this.power.update(realSeconds);
    this.hd.setLights(lights);
    this.room.setLight(lights.room);
    const reels = scaleTint(0xffffff, lights.reels);
    this.benchReels.root.tint = reels;
    this.botReel.tint = reels;
    this.vaultBeams.tint = reels;
  }

  /** Every drag ends, nothing fired. For a touch the OS cancelled (`id`; no up comes), the vault's key only if that
   *  finger holds it (else it stays locked to a dead finger); the others follow any one pointer, so they go too. */
  private cancelDrags(id?: number): void {
    for (const d of [this.bench, this.tray, this.botCard]) d.cancelDrag();
    this.vault.cancelDrag(id);
  }

  /** Pointer → world px, through the camera (shake and zoom). Fractional, so lifted items glide. */
  private worldPt(e: FederatedPointerEvent): Pt {
    const p = this.pixel.view.toLocal(e.global);
    return { x: p.x, y: p.y };
  }

  private applyLayout(): void {
    // the screen changed: a knife in the air goes straight back into its card
    this.benchFx.cancelKnife();
    const { width, height } = this.app.screen;
    this.screen = { w: width, h: height };
    this.pixel.resize(this.vp);
    this.room.layout(this.l);
    this.bench.layout(this.l);
    this.bot.layout(this.l);
    this.tray.layout(this.l);
    this.benchReels.layout(this.l);
    if (this.l.bot.reel) this.botReel.layout(this.l.bot.reel);
    this.botCard.layout(this.l);
    this.hd.layout(this.l, this.vp, width, height);
    this.vaultBeams.layout(this.vault.layout(this.screen, this.vp.scale), this.vp.scale);
    const k = this.vp.scale;
    const size = hdFontSize(k);
    for (const txt of [this.hint, ...this.label, this.offline, this.trayFullLabel]) txt.style.fontSize = size;
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
    const key = this.controller.run.locked() ? null : hintKey(b, this.l.portrait); // no "Buy a case" while the vault is out or after the run
    const hint = key ? t(key) : "";
    if (this.hint.text !== hint) this.hint.text = hint;
    const r = this.benchReels.area ?? this.l.you.reel; // under the reel window, whatever its height
    this.hint.position.set((r.x + r.w / 2) * this.vp.scale, (r.y + r.h + 2) * this.vp.scale);
    // the lines describe the best card waiting, under that card
    const best = b.phase === "revealed" ? bestSlot(b.cards) : null;
    const d = b.phase === "revealed" && best !== null ? b.cards[best]! : null;
    const lines = d ? revealLines(d) : ["", ""];
    lines.forEach((text, i) => {
      if (this.label[i]!.text !== text) this.label[i]!.text = text;
    });
    if (d) this.label[1]!.style.fill = RARITY_INFO[d.rarity].color;
    this.labelAt = best === null ? this.l.you.reveal : this.bench.cardCentre(best);
    this.placeLabels();
    const off = t("station.offline");
    if (this.offline.text !== off) this.offline.text = off;
    const full = t("float.trayfull");
    if (this.trayFullLabel.text !== full) this.trayFullLabel.text = full;
  }

  private placeLabels(): void {
    const k = this.vp.scale;
    const card = this.labelAt;
    const [a, b] = this.label as [Text, Text];
    const { lo, hi } = this.labelSpan;
    a.position.set(fitCentre(card.x * k, a.width, lo, hi), (card.y + 16) * k);
    b.position.set(fitCentre(card.x * k, b.width, lo, hi), a.y + a.height + k);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(e.caseId, true);
        this.audio.play("case-latch");
        break;
      case "spinStarted":
        this.bench.openCase();
        this.benchReels.start(e.caseId, e.reels, this.rng);
        this.audio.play("key-turn");
        this.audio.play("lid-creak", { delay: 0.12 });
        break;
      case "revealed":
        this.benchFx.revealed(e.drops);
        break;
      case "sold": {
        // only a bench sale clears the card; the bot's and the tray's sales burst coins from the bin
        const fromBench = e.from === "bench";
        const src =
          fromBench && e.source === "bench"
            ? this.bench.cardCentre(e.slot)
            : e.source === "bot"
              ? this.botCard.centre()
              : e.source === "seller"
                ? this.l.seller
                : this.l.bin;
        const at = this.hd.toScreen(src);
        this.hd.coins.burst(at, { x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }, e.amount);
        this.hd.coins.floatText({ x: at.x, y: at.y - 10 * this.vp.scale }, `+${formatCash(e.amount, getLang())}`);
        this.audio.play(e.source === "seller" ? "seller-sell" : "cash-register");
        this.audio.play("coin-clink", { rate: comboPitch(e.combo), delay: 0.05 });
        if (e.amount >= 100) this.audio.play("coin-cascade", { delay: 0.1 });
        if (fromBench) this.benchFx.left(e.slot, e.source === "bench", this.controller.run.state.bench); // a machine sale just clears it
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
        const at = this.hd.toScreen(this.botCard.centre());
        this.hd.particles.burst(at, RARITY_INFO[e.drop.rarity].color, 18, 160 * (this.vp.scale / 6));
        this.audio.play("reveal-chime", { gain: 0.5, rate: 2 ** (RARITY_ORDER.indexOf(e.drop.rarity) / 6) });
        break;
      }
      case "dayJobDone": {
        const tb = this.l.table;
        const at = this.hd.toScreen({ x: tb.x + tb.w / 2, y: tb.y + 12 });
        this.hd.coins.floatText(at, e.amount > 0 ? `+${formatCash(e.amount, getLang())}` : t("float.nopay"));
        this.audio.play(e.amount > 0 ? "dayjob-pay" : "dayjob-nopay");
        break;
      }
      case "stored":
        if (e.from === "bench") this.benchFx.left(e.slot, false, this.controller.run.state.bench);
        this.audio.play("tray-store");
        break;
      case "vaultBought":
        // the screen goes to the vault: it slams in, the suspense loop takes over the music
        this.cancelDrags();
        this.benchFx.cancelKnife();
        this.vault.slam();
        this.audio.setTrack("vault-suspense", { loop: true });
        break;
      case "vaultKeyTurned": // the suspense fades out; the fanfare waits for the impact (musicPlan)
        this.vaultBeams.start(e.drops);
        this.resumeMusic();
        break;
      case "vaultReelLanded":
        this.vaultBeams.landed(e.index, e.drop, e.amount);
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
        this.cancelDrags();
        this.benchFx.clearAll();
        this.vaultBeams.hide();
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
}
