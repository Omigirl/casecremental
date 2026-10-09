import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { t as tr } from "../../i18n/index";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { AudioEngine } from "../audio/AudioEngine";
import { pixelStyle } from "../hd/font";
import type { HdLayer } from "../hd/HdLayer";
import { KnifeFlight } from "../hd/knifeFlight";
import { Coins } from "../juice/coins";
import { Particles } from "../juice/particles";
import type { Pt, Rect, TableLayout } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import type { SpriteLibrary } from "../pixel/sprites";
import { legacyVaultCues as vaultCues, VAULT_CUE_TIMES } from "./legacyCues";

// Vault Case I takes the screen (rework spec §4): a dark room, the vault slammed into the centre, the devil
// key floating beside it until the player drags it into the lock; then the legendary-chest opening — the lock
// spins, chains snap, light bursts, the lid opens on a golden column, coins fountain, fireworks go off — while
// the World's five stacked reels slide in above it. Everything here is in screen px, over the scene and
// under the HD overlay (flash, vignette, the blackout's veil). The World drives it from the sim each frame.

export type VaultPhase = "key" | "opening" | "done" | null;

/** Where the vault's five reels stack (world px): the HUD and the panels are gone, so they take the top of
 *  the table's width. */
export function vaultReelArea(l: TableLayout): Rect {
  return { x: l.table.x + 8, y: 6, w: l.table.w - 16, h: l.table.y + 44 - 6 };
}

// The chest inside its 68×78 frame (vault-case.json): the body's centre (the anchor — the lid opens upward
// from it), the lock, the mouth the light comes out of, the body's width and the open chest's height.
const VAULT_FRAME = { w: 68, h: 78, frames: 4 };
const BODY = { x: 34.5, y: 64 };
const LOCK = { x: 35, y: 64 };
const MOUTH = { x: 34.5, y: 52 };
const BODY_W = 40;
const OPEN_H = 45;
/** The open chest's visual centre sits this far (frame px) above the body's centre. */
const OPEN_LIFT = 9;
// The devil key inside its 26×38 frame: the drawn key's centre.
const KEY_FRAME = { w: 26, h: 38, frames: 4 };
const KEY_CENTRE = { x: 10, y: 29.5 };

const SLAM_SECONDS = 0.35;
const DIM_KEY = 0.8;
const DIM_OPEN = 0.86;
const EMBER = 0xff5a1f;
const GOLD = 0xffd34d;
const FIREWORK_EVERY = 1.2;
const FIREWORK_COLORS = [RARITY_INFO.covert.color, RARITY_INFO.gold.color, RARITY_INFO.classified.color, 0xffffff, 0x7affc1];

const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return Texture.from(c);
}

interface Coin {
  s: Sprite;
  vx: number;
  vy: number;
  age: number;
}

export class VaultScene {
  readonly root = new Container();
  /** The World puts its pixel layer of stacked reels here; it slides in as the lid opens. */
  readonly reelSlot = new Container();
  private readonly dim = new Graphics();
  private readonly rays: Sprite;
  private readonly glow: Sprite;
  private readonly beam: Sprite;
  private readonly vault: Sprite;
  private readonly fountain = new Container();
  private readonly keyGlow: Sprite;
  private readonly key: Sprite;
  private readonly hint = new Text({ text: "", style: pixelStyle(8, 0xffd0c0) });
  private readonly particles: Particles;
  private readonly coins: Coins;
  private readonly fx = new Container();
  private readonly flight: KnifeFlight;
  private readonly textures: Texture[];
  private readonly vaultFrames: readonly Texture[];
  private readonly keyFrames: readonly Texture[];
  private readonly coinFrames: readonly Texture[];

  private phase: VaultPhase = null;
  private t = 0;
  private landed = 0;
  private drops: readonly Drop[] = [];
  private clock = 0;
  private screen = { w: 1, h: 1 };
  private k = 1;
  /** Screen px per vault-sprite px while it waits (a whole number: crisp pixels). */
  private S = 1;
  private Sf = 1;
  private centre: Pt = { x: 0, y: 0 };
  private low: Pt = { x: 0, y: 0 };
  private keyHome: Pt = { x: 0, y: 0 };
  private keyPos: Pt = { x: 0, y: 0 };
  private keySpin = 0;
  private slamT: number | null = null;
  private slamPending = false;
  private punch = 0;
  private emberT = 0;
  private whisperT = 1.5;
  private fountainT = 0;
  private fireworkT = 0;
  private live: Coin[] = [];
  private drag: { start: Pt; grab: Pt; moved: number } | null = null;

  constructor(
    lib: SpriteLibrary,
    private readonly hd: HdLayer,
    private readonly audio: AudioEngine,
    private readonly shake: (trauma: number) => void,
  ) {
    const soft = canvasTexture(128, 128, (g) => {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    });
    const dot = canvasTexture(16, 16, (g) => {
      const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.6)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 16, 16);
    });
    // god rays: wedges from the centre, fading outward
    const rays = canvasTexture(512, 512, (g) => {
      const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const w = (Math.PI / n) * (i % 2 ? 0.35 : 0.6);
        g.beginPath();
        g.moveTo(256, 256);
        g.arc(256, 256, 256, a - w, a + w);
        g.closePath();
        g.fill();
      }
    });
    // the golden column: bright in the middle, soft at the edges, fading toward the top
    const beam = canvasTexture(64, 256, (g) => {
      const h = g.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, "rgba(255,255,255,0)");
      h.addColorStop(0.35, "rgba(255,255,255,0.55)");
      h.addColorStop(0.5, "rgba(255,255,255,1)");
      h.addColorStop(0.65, "rgba(255,255,255,0.55)");
      h.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = h;
      g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = "destination-in";
      const v = g.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.5, "rgba(0,0,0,0.7)");
      v.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = v;
      g.fillRect(0, 0, 64, 256);
    });
    this.textures = [soft, dot, rays, beam];

    const vs = lib.get("vault-case", VAULT_FRAME);
    const ks = lib.get("devil-key", KEY_FRAME);
    this.vaultFrames = vs.frames;
    this.keyFrames = ks.frames;
    this.coinFrames = lib.get("coin", { w: 12, h: 22, frames: 4 }).frames;
    for (const f of [...this.vaultFrames, ...this.keyFrames, ...this.coinFrames]) f.source.scaleMode = "nearest";

    this.rays = new Sprite({ texture: rays, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.glow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.beam = new Sprite({ texture: beam, anchor: { x: 0.5, y: 1 }, blendMode: "add", alpha: 0, tint: 0xffe08a });
    this.vault = new Sprite({ texture: this.vaultFrames[0], anchor: { x: BODY.x / VAULT_FRAME.w, y: BODY.y / VAULT_FRAME.h } });
    this.keyGlow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0, tint: 0xff2a10 });
    this.key = new Sprite({ texture: this.keyFrames[0], anchor: { x: KEY_CENTRE.x / KEY_FRAME.w, y: KEY_CENTRE.y / KEY_FRAME.h } });
    this.particles = new Particles(dot);
    this.coins = new Coins(this.coinFrames);
    this.hint.anchor.set(0.5, 0);
    this.flight = new KnifeFlight(this.fx);
    this.fx.addChild(this.particles.container, this.coins.container);
    this.root.addChild(
      this.dim,
      this.rays,
      this.glow,
      this.beam,
      this.vault,
      this.fountain,
      this.reelSlot,
      this.keyGlow,
      this.key,
      this.hint,
      this.fx,
    );
    this.root.visible = false;
  }

  layout(screen: { w: number; h: number }, l: TableLayout, k: number): void {
    const { w, h } = screen;
    this.screen = { w, h };
    this.k = k;
    this.flight.cancel();
    this.dim
      .clear()
      .rect(-40, -40, w + 80, h + 80)
      .fill({ color: 0x000000 });
    this.S = Math.max(1, Math.floor(Math.min((h * 0.5) / OPEN_H, (w * 0.62) / BODY_W)));
    this.Sf = Math.max(1, Math.round(this.S * 0.55));
    this.centre = { x: w / 2, y: Math.round(h * 0.5 + OPEN_LIFT * this.S * 0.5) };
    const area = vaultReelArea(l);
    const reelsBottom = (area.y + area.h) * k;
    const lowY = (reelsBottom + h) / 2 + OPEN_LIFT * this.Sf;
    this.low = { x: w / 2, y: Math.min(lowY, h - 14 * this.Sf - 4) };
    this.keyHome = { x: this.centre.x - BODY_W * this.S * 0.5 - 16 * this.S * 0.6, y: this.centre.y - 6 * this.S };
    if (!this.drag) this.keyPos = { ...this.keyHome };
    this.rays.width = this.rays.height = Math.max(w, h) * 1.2;
    this.glow.width = this.glow.height = BODY_W * this.S * 2.6;
    this.beam.width = BODY_W * this.S * 0.7;
    this.beam.height = h * 1.1;
    this.hint.style.fontSize = Math.round(hdFontSize(k) * 1.5);
    this.coins.setScale(k, hdFontSize(k, 16));
  }

  /** The vault was bought just now: it drops in from above instead of just being there. */
  slam(): void {
    this.slamPending = true;
  }

  /** The sim's vault this frame; "done" holds the last frame while the blackout falls. */
  show(phase: VaultPhase, t: number, drops: readonly Drop[], landed: number): void {
    if (phase !== this.phase) this.enter(phase, t);
    if (phase === "opening") {
      const prev = this.t;
      const at = (x: number) => prev < x && t >= x;
      const T = VAULT_CUE_TIMES;
      if (at(0)) this.audio.play("vault-lock-spin");
      if (at(T.chains)) this.chains();
      if (at(T.burst)) this.burst();
      if (at(T.open)) this.open();
      this.t = t;
    }
    this.drops = drops;
    this.landed = landed;
  }

  /** A pointer went down at `p` (screen px): grab the key if it is on it. */
  keyHit(p: Pt): boolean {
    if (this.phase !== "key" || this.slamT !== null) return false;
    const q = this.local(p);
    const r = Math.max(28, KEY_FRAME.h * this.keyScale() * 0.45);
    if (dist(q, this.keyPos) > r) return false;
    this.drag = { start: q, grab: { x: this.keyPos.x - q.x, y: this.keyPos.y - q.y }, moved: 0 };
    this.audio.play("key-turn", { gain: 0.4, rate: 0.7 });
    return true;
  }

  keyMove(p: Pt): void {
    const d = this.drag;
    if (!d) return;
    const q = this.local(p);
    this.keyPos = { x: q.x + d.grab.x, y: q.y + d.grab.y };
    d.moved = Math.max(d.moved, dist(q, d.start));
  }

  /** Released: "turn" in the lock (or on a tap), else the key floats back. */
  keyRelease(p: Pt): "turn" | "none" {
    const d = this.drag;
    if (!d) return "none";
    this.keyMove(p);
    this.drag = null;
    const inLock = dist(this.keyPos, this.lockPos()) <= BODY_W * this.S * 0.2;
    return d.moved < 6 || inLock ? "turn" : "none";
  }

  cancelDrag(): void {
    this.drag = null;
  }

  /** Sparks where a hands-off click lands. */
  sparks(p: Pt): void {
    const q = this.local(p);
    this.particles.burst(q, FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]!, 14, 220 * (this.k / 6));
  }

  /** A firework at `p` (screen px; the World's reel landings), or a random one in the upper half. */
  firework(p?: Pt, color?: number, big = false): void {
    const at = p ? this.local(p) : { x: this.screen.w * (0.15 + Math.random() * 0.7), y: this.screen.h * (0.08 + Math.random() * 0.4) };
    const c = color ?? this.fireworkColor();
    const v = this.k / 6;
    this.particles.burst(at, c, big ? 140 : 70, (big ? 520 : 360) * v, 260 * v);
    this.particles.burst(at, 0xffffff, big ? 40 : 18, 160 * v, 120 * v);
    if (!p) this.audio.play("firework", { gain: 0.5, rate: 0.9 + Math.random() * 0.25 });
  }

  floatText(p: Pt, text: string): void {
    this.coins.floatText(this.local(p), text);
  }

  /** The legendary's b-roll shot, its animated texture playing as it turns. */
  showcase(frames: readonly Texture[], p: Pt, size: number, onLand: () => void, fps = 8): void {
    this.flight.start(frames, this.local(p), size, onLand, fps);
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    this.clock += dt;
    const S = this.S;
    const v = this.k / 6;
    const opening = this.phase === "opening" || (this.phase === "done" && this.t > 0);
    const c = vaultCues(opening ? this.t : -1);
    const reelsIn = opening ? easeOut(c.reelsIn) : 0;

    // the room behind darkens
    const dimTarget = this.phase === "key" ? DIM_KEY : DIM_OPEN;
    this.dim.alpha += (dimTarget - this.dim.alpha) * Math.min(1, dt * 3);

    // the vault: slammed in, breathing while it waits, trembling before it bursts, then sinking under the reels
    let pos = { x: lerp(this.centre.x, this.low.x, reelsIn), y: lerp(this.centre.y, this.low.y, reelsIn) };
    let sx = lerp(S, this.Sf, reelsIn);
    let sy = sx;
    if (this.slamT !== null) {
      const before = this.slamT;
      this.slamT += dt;
      const u = this.slamT / SLAM_SECONDS;
      if (u < 1) pos = { x: pos.x, y: pos.y - (1 - u * u) * (pos.y + OPEN_H * S) };
      else {
        if (before < SLAM_SECONDS) this.landSlam();
        const b = this.slamT - SLAM_SECONDS;
        const squash = Math.exp(-b * 9) * Math.sin(b * 34) * 0.14;
        sx *= 1 + squash;
        sy *= 1 - squash;
        if (b > 0.6) this.slamT = null;
      }
    } else if (this.phase === "key") {
      const breathe = 1 + 0.02 * Math.sin(this.clock * 2.2);
      sx *= breathe;
      sy *= breathe;
    }
    if (opening && this.t >= VAULT_CUE_TIMES.chains && this.t < VAULT_CUE_TIMES.open) {
      const tremble = ((this.t - VAULT_CUE_TIMES.chains) / (VAULT_CUE_TIMES.open - VAULT_CUE_TIMES.chains)) * S * 0.6;
      pos = { x: pos.x + (Math.random() - 0.5) * tremble, y: pos.y + (Math.random() - 0.5) * tremble * 0.5 };
      if (this.phase === "opening") this.shake(dt * 2.2);
    }
    this.punch = Math.max(0, this.punch - dt * 3);
    const p = 1 + 0.12 * this.punch;
    const near = this.phase === "key" && !!this.drag && dist(this.keyPos, this.lockPos()) <= BODY_W * S * 0.3;
    this.vault.texture = this.vaultFrames[opening ? c.vaultFrame : near ? 1 : 0]!;
    this.vault.position.set(Math.round(pos.x), Math.round(pos.y));
    this.vault.scale.set(sx * p, sy * p);
    const scaleNow = sx * p;

    // light: devilish red while it waits, gold once it opens
    const mouth = { x: pos.x + (MOUTH.x - BODY.x) * scaleNow, y: pos.y + (MOUTH.y - BODY.y) * scaleNow };
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3.1);
    this.glow.position.set(pos.x, pos.y - OPEN_LIFT * scaleNow * 0.5);
    this.glow.scale.set((BODY_W * scaleNow * 2.6) / 128);
    this.rays.position.set(pos.x, pos.y - OPEN_LIFT * scaleNow);
    this.rays.rotation += dt * (opening && this.t >= VAULT_CUE_TIMES.burst ? 0.3 : 0.12);
    if (!opening) {
      this.glow.tint = 0xff2a1a;
      this.glow.alpha = (near ? 0.75 : 0.35) + 0.25 * pulse;
      this.rays.tint = 0xff3020;
      this.rays.alpha = 0.1 + 0.05 * pulse;
    } else {
      const charge = Math.min(1, this.t / VAULT_CUE_TIMES.open);
      this.glow.tint = this.t < VAULT_CUE_TIMES.burst ? 0xffb040 : GOLD;
      this.glow.alpha = 0.3 + 0.6 * charge + 0.1 * pulse;
      this.rays.tint = 0xffe08a;
      this.rays.alpha = this.t < VAULT_CUE_TIMES.burst ? 0.1 * charge : Math.min(0.6, 0.1 + (this.t - VAULT_CUE_TIMES.burst) * 0.6);
    }
    this.beam.position.set(mouth.x, mouth.y);
    this.beam.alpha = c.beam * (0.8 + 0.2 * Math.sin(this.clock * 7));
    this.beam.width = BODY_W * scaleNow * 0.7 * (0.9 + 0.1 * Math.sin(this.clock * 11));

    this.updateKey(dt, opening, c.lockSpin);

    // the reels slide down into place as the lid opens
    this.reelSlot.alpha = opening ? c.reelsIn : 0;
    this.reelSlot.y = Math.round(-(1 - reelsIn) * 40 * this.k);

    // the hint, pulsing, while the key waits
    const hint = tr("hint.vaultkey");
    if (this.hint.text !== hint) this.hint.text = hint;
    this.hint.visible = this.phase === "key" && this.slamT === null;
    this.hint.alpha = 0.6 + 0.4 * pulse;
    this.hint.position.set(this.centre.x, this.centre.y + 16 * S);

    // emitters: coins fountain out of the mouth, fireworks go off overhead
    if (this.phase === "opening" && c.fountain) {
      for (this.fountainT += dt; this.fountainT >= 0.1; this.fountainT -= 0.1) this.spawnCoins(mouth, this.t > 20 ? 1 : 3);
      // after the legendary lands the sky goes off twice as often
      const every = this.landed >= 5 ? FIREWORK_EVERY / 2 : FIREWORK_EVERY;
      for (this.fireworkT += dt; this.fireworkT >= every; this.fireworkT -= every) this.firework();
    }
    this.updateCoins(dt, v);
    this.particles.update(dt);
    this.coins.update(dt);
    this.flight.update(dt);
  }

  destroy(): void {
    this.flight.cancel();
    this.coins.destroy();
    this.root.destroy({ children: true });
    for (const tex of this.textures) tex.destroy(true);
  }

  private enter(phase: VaultPhase, t: number): void {
    const was = this.phase;
    this.phase = phase;
    if (phase === null) {
      this.root.visible = false;
      this.dim.alpha = 0;
      this.drag = null;
      this.slamT = null;
      this.slamPending = false;
      this.flight.cancel();
      for (const c of this.live) c.s.destroy();
      this.live = [];
      this.t = 0;
      return;
    }
    if (phase === "done") return; // hold the last frame (a reload on the prestige screen shows nothing)
    this.root.visible = true;
    if (phase === "key") {
      this.keyPos = { ...this.keyHome };
      this.keySpin = 0;
      this.whisperT = 2.5;
      if (this.slamPending) {
        this.slamT = 0;
        this.audio.play("vault-slam", { delay: SLAM_SECONDS * 0.8 });
        this.audio.play("vault-rumble", { delay: SLAM_SECONDS * 0.8 });
      } else this.dim.alpha = DIM_KEY; // a reload: already there
      this.slamPending = false;
    } else {
      // opening: live after the key turned, or a reload part-way (no cue replays before `t`)
      this.t = was === "key" ? -1e-6 : t;
      this.fountainT = 0;
      this.fireworkT = FIREWORK_EVERY * 0.6;
      this.slamT = null;
      this.drag = null;
      if (was !== "key") this.dim.alpha = DIM_OPEN;
    }
  }

  private landSlam(): void {
    const S = this.S;
    const base = { x: this.centre.x, y: this.centre.y + 13 * S };
    this.shake(0.6);
    this.hd.flash(0xff3b1f, 0.25);
    const v = this.k / 6;
    this.particles.burst({ x: base.x - BODY_W * S * 0.4, y: base.y }, 0x8a7f70, 30, 260 * v);
    this.particles.burst({ x: base.x + BODY_W * S * 0.4, y: base.y }, 0x8a7f70, 30, 260 * v);
    this.particles.burst(this.keyHome, EMBER, 40, 240 * v, -200 * v);
    this.audio.play("devil-key-laugh", { delay: 0.35 });
  }

  /** The chains snap: the key's work is done, it bursts into embers. */
  private chains(): void {
    const v = this.k / 6;
    this.audio.play("chain-snap");
    this.shake(0.4);
    this.punch = 0.6;
    const lock = this.lockPos();
    this.particles.burst(lock, EMBER, 60, 320 * v, -240 * v);
    this.particles.burst(lock, 0xc8ccd8, 36, 420 * v);
  }

  /** Light bursts through the cracks. */
  private burst(): void {
    const v = this.k / 6;
    this.hd.flash(0xfff3b0, 0.8);
    this.audio.play("light-burst");
    this.shake(0.5);
    this.punch = 1;
    this.particles.burst({ x: this.centre.x, y: this.centre.y - OPEN_LIFT * this.S }, 0xfff3b0, 90, 520 * v);
  }

  /** The lid flies open: the column of light and the fountain begin. */
  private open(): void {
    const v = this.k / 6;
    this.hd.flash(GOLD, 0.45);
    this.audio.play("coin-fountain");
    this.shake(0.45);
    this.punch = 0.8;
    const mouth = { x: this.centre.x, y: this.centre.y + (MOUTH.y - BODY.y) * this.S };
    this.particles.burst(mouth, GOLD, 160, 600 * v, 400 * v);
    this.spawnCoins(mouth, 18);
  }

  private updateKey(dt: number, opening: boolean, lockSpin: boolean): void {
    const ks = this.keyScale();
    if (this.phase === "key") {
      this.key.visible = this.keyGlow.visible = true;
      this.key.alpha = 1;
      this.key.texture = this.keyFrames[Math.floor(this.clock * 6) % this.keyFrames.length]!;
      const bob = Math.sin(this.clock * 2.4) * 4 * Math.max(1, this.k / 6);
      if (!this.drag) {
        const home = { x: this.keyHome.x, y: this.keyHome.y + bob };
        const u = Math.min(1, dt * 8);
        this.keyPos = { x: lerp(this.keyPos.x, home.x, u), y: lerp(this.keyPos.y, home.y, u) };
      }
      const hidden = this.slamT !== null && this.slamT < SLAM_SECONDS;
      this.key.visible = this.keyGlow.visible = !hidden;
      this.key.rotation = this.drag ? Math.sin(this.clock * 20) * 0.08 : 0.12 * Math.sin(this.clock * 1.7);
      this.key.scale.set(ks * (this.drag ? 1.1 : 1));
      if (!hidden) {
        this.whisperT -= dt;
        if (this.whisperT <= 0) {
          this.whisperT = 6 + Math.random() * 2;
          this.audio.play("devil-key-whisper");
        }
        for (this.emberT += dt; this.emberT >= 0.5; this.emberT -= 0.5) {
          const v = this.k / 6;
          this.particles.burst(this.keyPos, Math.random() < 0.3 ? 0xffb020 : EMBER, 2, 60 * v, -140 * v);
        }
      }
    } else if (opening && lockSpin && this.phase === "opening") {
      // in the lock, turning fast
      this.key.visible = this.keyGlow.visible = true;
      const lock = this.lockPos();
      const u = Math.min(1, dt * 18);
      this.keyPos = { x: lerp(this.keyPos.x, lock.x, u), y: lerp(this.keyPos.y, lock.y, u) };
      this.keySpin += dt * (6 + this.t * 14);
      this.key.rotation = this.keySpin;
      this.key.scale.set(ks * (1 + 0.15 * Math.sin(this.clock * 30)));
      this.key.texture = this.keyFrames[Math.floor(this.clock * 12) % this.keyFrames.length]!;
    } else {
      this.key.visible = this.keyGlow.visible = false;
    }
    this.key.position.set(Math.round(this.keyPos.x), Math.round(this.keyPos.y));
    this.keyGlow.position.copyFrom(this.key.position);
    this.keyGlow.scale.set((KEY_FRAME.h * ks * 1.4) / 128);
    this.keyGlow.alpha = 0.55 + 0.3 * Math.sin(this.clock * 5);
  }

  private spawnCoins(at: Pt, n: number): void {
    const k = this.k;
    for (let i = 0; i < n; i++) {
      const s = new Sprite({ texture: this.coinFrames[0], anchor: 0.5 });
      s.scale.set(k * 0.6);
      s.position.set(at.x + (Math.random() - 0.5) * BODY_W * this.Sf * 0.5, at.y);
      this.fountain.addChild(s);
      this.live.push({ s, vx: (Math.random() - 0.5) * 120 * k, vy: -(110 + Math.random() * 90) * k, age: Math.random() });
    }
  }

  private updateCoins(dt: number, v: number): void {
    const g = 1500 * v;
    this.live = this.live.filter((c) => {
      c.age += dt;
      c.vy += g * dt;
      c.s.x += c.vx * dt;
      c.s.y += c.vy * dt;
      c.s.texture = this.coinFrames[Math.floor(c.age * 14) % this.coinFrames.length]!;
      if (c.s.y > this.screen.h + 40) {
        c.s.destroy();
        return false;
      }
      return true;
    });
  }

  /** A landed drop's rarity colour (the sky celebrates what came out), or a festive one. */
  private fireworkColor(): number {
    const got = this.drops.slice(0, this.landed);
    if (got.length && Math.random() < 0.6) return RARITY_INFO[got[Math.floor(Math.random() * got.length)]!.rarity].color;
    return FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]!;
  }

  private keyScale(): number {
    return Math.max(2, Math.round(this.S * 0.8));
  }

  /** The lock, where the vault is now (screen px, the root's space). */
  private lockPos(): Pt {
    const s = this.vault.scale.x || this.S;
    return { x: this.vault.x + (LOCK.x - BODY.x) * s, y: this.vault.y + (LOCK.y - BODY.y) * s };
  }

  private local(p: Pt): Pt {
    return { x: p.x - this.root.x, y: p.y - this.root.y };
  }
}
