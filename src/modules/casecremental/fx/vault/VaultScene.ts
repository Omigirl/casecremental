import { Container, Graphics, Text, type Texture } from "pixi.js";
import { getLang, t as tr } from "../../i18n/index";
import { formatCash } from "../../sim/format";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { AudioEngine } from "../audio/AudioEngine";
import { moneyStyle, pixelStyle } from "../hd/font";
import type { HdLayer } from "../hd/HdLayer";
import type { Shake } from "../juice/shake";
import type { Pt } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import type { SpriteLibrary } from "../pixel/sprites";
import { breath, dueBeats, type DueBeat } from "./beats";
import { VaultChaos } from "./chaos";
import { chaosBeat, flashCrossed } from "./chaosPlan";
import { Chest } from "./chest";
import { countUp } from "./countUp";
import { VAULT_CUES, vaultCues, type VaultCues } from "./cues";
import { DevilKey, dist, EMBER, KEY_FRAME } from "./devilKey";
import { Rays } from "./rays";
import { vaultTextures } from "./textures";
import { VaultFx } from "./vaultFx";
import { BODY_W, VAULT_FRAME, vaultLayout, type VaultLayout } from "./vaultLayout";

// Vault Case I takes the screen (rework spec §4, jackpot spec 2026-10-09): a dark room, the vault slammed into
// the centre, the devil key floating beside it until the player drags it into the lock; then the legendary
// chest — it trembles at lower centre, snaps open on the fanfare's first downbeat, five beams pour out of it past
// the screen edges (VaultBeams, in the beam/stream/label slots), coins and fireworks fly, the total counts up, and
// it holds. The chaos layer (VaultChaos) shakes, sways and rains behind all of it to the drum-and-bass drop, and a
// kick explodes somewhere on screen every VAULT_CUES.fireworks time. Screen px, over the scene and under the HD
// overlay. The World drives it from the sim each frame: each beat fires once when the sim's t crosses it, and a
// reload or a lobby trip lands on t without replaying any.

export type VaultPhase = "key" | "opening" | "done" | null;

const SLAM_DELAY = 0.28;
const DIM_KEY = 0.8;
const DIM_OPEN = 0.86;
const GOLD = 0xffd34d;
const FIREWORK_COLORS = [RARITY_INFO.covert.color, RARITY_INFO.gold.color, RARITY_INFO.classified.color, 0xffffff, 0x7affc1];
/** Where the kicks burst, kick i at spot i (shares of the screen, jittered): the corners and sides as well as the sky. */
const KICK_SPOTS: readonly (readonly [number, number])[] = [
  [0.5, 0.14],
  [0.1, 0.12],
  [0.9, 0.16],
  [0.08, 0.52],
  [0.92, 0.46],
  [0.3, 0.3],
  [0.7, 0.26],
  [0.1, 0.86],
  [0.9, 0.84],
  [0.5, 0.4],
];
const KICK_JITTER = 0.06;
const jitter = () => (Math.random() - 0.5) * 2 * KICK_JITTER;
/** The impact's flash, and a kick's (in its colour). */
const IMPACT_FLASH = 0.35;
const KICK_FLASH = 0.16;
/** The hold: the particles die away over this long after the count-up. */
const FADE_SECONDS = 1.5;
/** The cues while the key waits (or the vault is away): nothing has started. */
const WAITING: VaultCues = vaultCues(-1);

export class VaultScene {
  readonly root = new Container();
  /** VaultBeams' layers: the beams behind the sky's particles; the streamed items and rewards behind the chest
   *  (they pour out of it); the labels in front of every particle. */
  readonly beamSlot = new Container();
  readonly streamSlot = new Container();
  readonly labelSlot = new Container();
  /** The soft glow and the coin's spin, shared with VaultBeams. */
  readonly art: { soft: Texture; coins: readonly Texture[] };
  private readonly dim = new Graphics();
  private readonly rays: Rays;
  private readonly chest: Chest;
  private readonly fx: VaultFx;
  private readonly chaos: VaultChaos;
  private readonly key: DevilKey;
  private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xffd0c0) });
  private readonly total = new Text({ text: "", style: moneyStyle(16) });
  private readonly textures: Texture[];

  private phase: VaultPhase = null;
  private t = 0;
  private landed = 0;
  private drops: readonly Drop[] = [];
  private sum = 0;
  private clock = 0;
  private screen = { w: 1, h: 1 };
  private k = 1;
  private L: VaultLayout | null = null;
  private sky = { top: 0, bottom: 1 };
  private seamT = 0;
  private totalPop = 0;
  private tickText = "";
  private slamPending = false;
  /** This frame's cues, computed once (show) and shared: the chest, the light, the beams' pulse (the World). */
  private frameCues: VaultCues = WAITING;

  constructor(
    lib: SpriteLibrary,
    private readonly hd: HdLayer,
    private readonly audio: AudioEngine,
    private readonly shake: Pick<Shake, "add">,
    /** Re-apply the music from the sim (the fanfare starts on the impact). */
    private readonly music: () => void,
  ) {
    const { soft, dot, star } = vaultTextures();
    this.textures = [soft, dot, star];

    const vaultFrames = lib.get("vault-case", VAULT_FRAME).frames;
    const keyFrames = lib.get("devil-key", KEY_FRAME).frames;
    const coinFrames = lib.get("coin", { w: 12, h: 22, frames: 4 }).frames;
    for (const f of [...vaultFrames, ...keyFrames, ...coinFrames]) f.source.scaleMode = "nearest";

    this.art = { soft, coins: coinFrames };
    this.rays = new Rays(soft);
    this.chest = new Chest(vaultFrames, soft);
    this.fx = new VaultFx(dot, star, coinFrames);
    this.chaos = new VaultChaos({ dot, star, coins: coinFrames });
    this.key = new DevilKey(keyFrames, soft, audio, this.fx.sparks);
    this.hint.anchor.set(0.5, 0);
    this.total.anchor.set(0.5);
    // back to front: the dim; the chaos's backdrop (stripes, the light); its stage (the beams, the fireworks and
    // coins, the rain); the streamed items and rewards, the chest and its bursts — every particle under the labels —
    // then the labels, the total, the key
    this.chaos.backdrop.addChild(this.rays.root);
    this.chaos.stage.addChild(this.chest.glow, this.beamSlot, this.fx.back, this.chaos.rain);
    this.root.addChild(
      this.dim,
      this.chaos.backdrop,
      this.chaos.stage,
      this.streamSlot,
      this.chest.front,
      this.fx.front,
      this.labelSlot,
      this.total,
      this.key.glow,
      this.key.sprite,
      this.hint,
    );
    this.root.visible = false;
  }

  /** Lays the scene out; returns the layout (the beams) for VaultBeams. */
  layout(screen: { w: number; h: number }, k: number): VaultLayout {
    const { w, h } = screen;
    this.screen = { w, h };
    this.k = k;
    const L = (this.L = vaultLayout(screen, k));
    this.dim
      .clear()
      .rect(-40, -40, w + 80, h + 80)
      .fill({ color: 0x000000 });
    this.key.layout(L.key.home, L.key.S, k);
    this.chest.layout(L);
    this.rays.layout(screen, L.chest.S);
    this.fx.layout(screen, k);
    this.chaos.layout(screen, k);
    this.sky = { top: h * 0.04, bottom: L.chest.top * 0.55 }; // fireworks and glints
    this.hint.style.fontSize = Math.round(hdFontSize(k) * 1.5);
    this.total.style.fontSize = L.totalSize;
    this.total.position.set(L.totalAt.x, L.totalAt.y);
    return L;
  }

  /** This frame's cues (from the sim's t while it opens; the waiting ones before; held through "done"). */
  get cues(): VaultCues {
    return this.frameCues;
  }

  /** The room behind (the World's camera): the chaos's offset and zoom; identity while the vault is away. */
  get room(): { readonly x: number; readonly y: number; readonly zoom: number } {
    return this.chaos.room;
  }

  /** The vault was bought just now: it drops in from above instead of just being there. */
  slam(): void {
    this.slamPending = true;
  }

  /** The sim's vault this frame; "done" holds the last frame while the blackout falls. */
  show(phase: VaultPhase, t: number, drops: readonly Drop[], landed: number): void {
    if (phase !== this.phase) this.enter(phase, t);
    if (phase !== "opening") return;
    this.drops = drops;
    this.landed = landed;
    this.sum = drops.reduce((s, d) => s + d.value, 0);
    const prev = this.t;
    this.t = t;
    this.frameCues = vaultCues(t);
    for (const b of dueBeats(prev, t)) this.beat(b);
    // the full-screen flashes, within the photosensitivity budget (chaosPlan)
    const flash = flashCrossed(prev, t);
    if (flash === VAULT_CUES.impact) this.hd.flash(0xfff2c0, IMPACT_FLASH);
    else if (flash !== null) this.hd.flash(this.fireworkColor(), KICK_FLASH);
  }

  /** Pointer `id` went down at `p` (screen px): grab the key if it is on it. */
  keyHit(p: Pt, id: number): boolean {
    return this.phase === "key" && this.chest.settled && this.key.grab(this.local(p), id);
  }

  /** Pointer `id` moved: the key follows only the finger holding it. */
  keyMove(p: Pt, id: number): void {
    this.key.move(this.local(p), id);
  }

  /** Pointer `id` let go: "turn" in the lock (or on a tap), else the key floats back; another finger's is "none". */
  keyRelease(p: Pt, id: number): "turn" | "none" {
    return this.key.release(this.local(p), id, this.chest.lockPos(), BODY_W * this.chest.scale * 0.2);
  }

  /** Drop the key's drag (only pointer `id`'s, when given). */
  cancelDrag(id?: number): void {
    this.key.cancel(id);
  }

  /** Sparks where a hands-off click lands. */
  sparks(p: Pt): void {
    this.fx.sparks.burst(this.local(p), this.pick(FIREWORK_COLORS), 14, 220 * (this.k / 6));
  }

  /** A firework at `p` (the scene's still px; a beam's lock-in, which plays its own sound). It bursts on the
   *  shaking stage, spawned where it shows exactly on `p` this frame (not off by the shake or the kick's zoom). */
  firework(p: Pt, color?: number, big = false): void {
    this.fx.firework(this.chaos.toStage(p), color ?? this.fireworkColor(), big);
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    this.clock += dt;
    // "done" holds the last frame while the blackout falls, the chaos still moving gently (its hold level)
    if (this.phase === "done" && this.t > 0) this.t += dt;
    const opening = this.phase === "opening" || (this.phase === "done" && this.t > 0);
    const t = opening ? this.t : null;
    const cues = this.frameCues;

    // the room behind darkens
    const dimTarget = this.phase === "key" ? DIM_KEY : DIM_OPEN;
    this.dim.alpha += (dimTarget - this.dim.alpha) * Math.min(1, dt * 5);

    const near = this.phase === "key" && this.key.dragging && dist(this.key.pos, this.chest.lockPos()) <= BODY_W * this.chest.scale * 0.3;
    const chaos = this.chaos;
    // the chest bounces on this frame's beat (a function of t), before the chaos layer moves to its mouth
    if (this.chest.update(dt, this.clock, { t, cues, near, beat: t === null ? 0 : chaosBeat(t) })) this.landSlam();
    const mouth = this.chest.mouth();
    chaos.update(t, mouth);
    this.rays.update(dt, this.clock, t, cues, t !== null && cues.lid > 0 ? mouth : this.chest.centre(), chaos);
    this.beamSlot.tint = chaos.shimmer;
    // the rewards bob on the beat; their labels only tremble (at most 2 px), readable
    this.streamSlot.y = chaos.bob;
    this.labelSlot.position.set(chaos.wobble.x, chaos.wobble.y);
    this.key.update(dt, this.clock, this.phase === "key" && !this.chest.falling);

    // the hint, pulsing, while the key waits
    const hint = tr("hint.vaultkey");
    if (this.hint.text !== hint) this.hint.text = hint;
    this.hint.visible = this.phase === "key" && this.chest.settled;
    this.hint.alpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.clock * 3.1));
    if (this.L) this.hint.position.set(this.L.key.bottom.x, this.L.key.hintY);

    if (this.phase === "opening" && t !== null) {
      // sparks escape through the seam while it trembles
      if (cues.tremble > 0)
        for (this.seamT += dt * 30 * cues.tremble; this.seamT >= 1; this.seamT--)
          this.fx.seamSparks(this.chest.seamPos(), BODY_W * this.chest.scale * 0.7, 1);
      const fade = t < VAULT_CUES.celebrateTo ? 1 : Math.max(0, 1 - (t - VAULT_CUES.celebrateTo) / FADE_SECONDS);
      this.fx.emit(dt, mouth, cues.density * breath(t) * fade, this.sky);
    }
    this.updateTotal(dt, t);
    this.fx.update(dt);
  }

  destroy(): void {
    this.fx.clear();
    this.root.destroy({ children: true }); // every layer, the rays' root among them, once
    this.rays.destroy(); // its textures, once its sprites are gone
    this.chaos.destroy(); // its stripes' texture, once the sprite is gone
    for (const tex of this.textures) tex.destroy(true);
  }

  private beat(b: DueBeat): void {
    switch (b.beat) {
      case "keyTurn": // the key's work is done: it bursts into embers; the riser climbs to the impact
        this.audio.play("vault-riser");
        this.fx.sparks.burst(this.key.pos, EMBER, 40, 260 * (this.k / 6), -200 * (this.k / 6));
        break;
      case "impact": {
        this.shake.add(0.35); // its flash is the schedule's first (chaosPlan)
        this.fx.impact(this.chest.mouth());
        this.audio.play("vault-open-hit");
        this.music(); // the fanfare's first downbeat
        break;
      }
      case "firework":
        this.kick(b.kick ?? 0);
        break;
      case "celebrate":
        this.audio.play("coin-fountain");
        this.fx.shower(40);
        this.fx.coinArc(this.chest.mouth(), 24);
        this.totalPop = 1;
        break;
      case "tick": {
        const text = this.totalText(this.t);
        if (text !== this.tickText) this.audio.play("count-tick", { rate: 1 + (this.t - VAULT_CUES.celebrateFrom) * 0.2 });
        this.tickText = text;
        break;
      }
      case "countDone":
        this.audio.play("count-ding");
        this.totalPop = 1;
        this.fx.stars.burst({ x: this.total.x, y: this.total.y }, GOLD, 30, 320 * (this.k / 6), 200 * (this.k / 6));
        break;
    }
  }

  /** The five payouts counting up above the lid from 9.0, resolving at 11.5, held through the blackout. */
  private updateTotal(dt: number, t: number | null): void {
    const on = t !== null && t >= VAULT_CUES.celebrateFrom;
    this.total.visible = on;
    if (!on) return;
    const text = this.totalText(t);
    if (this.total.text !== text) this.total.text = text;
    this.total.alpha = Math.min(1, (t - VAULT_CUES.celebrateFrom) / 0.3);
    this.totalPop = Math.max(0, this.totalPop - dt * 4);
    // pops on the count's beats and pulses on the drop's, never past the layout's 1.25 (vaultLayout TOTAL_POP)
    this.total.scale.set(1 + Math.min(0.25, 0.25 * this.totalPop + 0.08 * this.chaos.beat));
    if (this.L) this.total.position.set(this.L.totalAt.x + this.chaos.wobble.x, this.L.totalAt.y + this.chaos.wobble.y);
  }

  private totalText(t: number): string {
    return tr("float.total", { n: `+${formatCash(countUp(t, this.sum), getLang())}` });
  }

  private enter(phase: VaultPhase, t: number): void {
    const was = this.phase;
    this.phase = phase;
    if (phase !== "done") this.frameCues = WAITING; // "done" holds the last frame's (constant through the hold)
    if (phase === null) {
      this.root.visible = false;
      this.dim.alpha = 0;
      this.key.cancel();
      this.chest.clearSlam();
      this.slamPending = false;
      this.fx.clear();
      this.chaos.reset();
      this.t = 0;
      return;
    }
    if (phase === "done") return; // hold the last frame (a reload on the prestige screen shows nothing)
    this.root.visible = true;
    if (phase === "key") {
      this.key.reset();
      if (this.slamPending) {
        this.chest.slam();
        this.audio.play("vault-slam", { delay: SLAM_DELAY });
        this.audio.play("vault-rumble", { delay: SLAM_DELAY });
      } else this.dim.alpha = DIM_KEY; // a reload: already there
      this.slamPending = false;
    } else {
      // opening: live after the key turned (every beat from 0 fires), or a restore part-way (none before t replay)
      this.t = was === "key" ? -1e-6 : t;
      this.tickText = this.totalText(this.t);
      this.chest.clearSlam();
      this.key.cancel();
      if (was !== "key") this.dim.alpha = DIM_OPEN;
    }
  }

  /** Kick `index` of VAULT_CUES.fireworks: a two-colour burst at its spot of KICK_SPOTS (corners and sides too) with
   *  its explosion — the same spot for the same kick, live or after a reload. */
  private kick(index: number): void {
    const { w, h } = this.screen;
    const [sx, sy] = KICK_SPOTS[index % KICK_SPOTS.length]!;
    const at = { x: w * (sx + jitter()), y: h * (sy + jitter()) };
    this.firework(at);
    this.firework(at);
    this.audio.play("firework", { gain: 0.7, rate: 0.9 + Math.random() * 0.25 });
  }

  private landSlam(): void {
    const L = this.L;
    if (!L) return;
    const S = L.key.S;
    const base = L.key.bottom;
    const v = this.k / 6;
    this.shake.add(0.6);
    this.hd.flash(0xff3b1f, 0.25);
    this.fx.sparks.burst({ x: base.x - BODY_W * S * 0.4, y: base.y - S }, 0x8a7f70, 30, 260 * v);
    this.fx.sparks.burst({ x: base.x + BODY_W * S * 0.4, y: base.y - S }, 0x8a7f70, 30, 260 * v);
    this.fx.sparks.burst(L.key.home, EMBER, 40, 240 * v, -200 * v);
    this.audio.play("devil-key-laugh", { delay: 0.35 });
  }

  /** A landed drop's rarity colour (the sky celebrates what came out), or a festive one. */
  private fireworkColor(): number {
    const got = this.drops.slice(0, this.landed);
    if (got.length && Math.random() < 0.6) return RARITY_INFO[this.pick(got).rarity].color;
    return this.pick(FIREWORK_COLORS);
  }

  private pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(Math.random() * xs.length)]!;
  }

  private local(p: Pt): Pt {
    return { x: p.x - this.root.x, y: p.y - this.root.y };
  }
}
