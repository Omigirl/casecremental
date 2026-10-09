import { Container, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";
import { VAULT_CUES, type VaultCues } from "./cues";
import { canvasTexture } from "./textures";

// The light behind the reward (spec 2026-10-09 §1-2): a slowly rotating starburst; the impact's vertical shaft;
// a rainbow fan of 14 rays anchored at the chest's mouth — broad dark rays at the back, narrow bright ones in
// the middle, sparse white sparkles in front — sweeping slowly while the columns spin and softening into a
// glow in the celebration. While the key waits, only the starburst turns, devilish red. Behind the columns.

const COLORS = [0xff3b3b, 0xff9a2e, 0xffe14d, 0x4dff7a, 0x3de8ff, 0x4d7bff, 0xff4dd8] as const;
/** The fan's half-spread from straight up (rad). */
const SPREAD = 1.15;
const BROAD = 0.15;
const NARROW = 0.045;
const SPARKLES = 16;
/** ~6°/s. */
const STARBURST_SPIN = (6 * Math.PI) / 180;
const SWEEP = 0.07;
const SHAFT_SECONDS = 1.6;
/** The fan's strength once the celebration has softened it (cues.rays rests here). */
const RESTING = 0.3;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const darken = (c: number, f: number) =>
  (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);

interface Sparkle {
  s: Sprite;
  phase: number;
  rate: number;
  placed: boolean;
}

export class Rays {
  readonly root = new Container();
  private readonly starburst: Sprite;
  private readonly shaft: Sprite;
  private readonly glow: Sprite;
  private readonly broad: Sprite[];
  private readonly narrow: Sprite[];
  private readonly sparkles: Sparkle[] = [];
  private readonly textures: Texture[];
  private length = 1;
  private size = 1;

  constructor(soft: Texture, sparkle: Texture) {
    // spokes from the centre, fading outward
    const spokes = canvasTexture(512, 512, (g) => {
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
    // a vertical shaft: bright in the middle, soft at the edges, fading toward the top
    const shaft = canvasTexture(64, 256, (g) => {
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
    // one ray: a wedge from its apex (bottom centre), brightest along its spine, fading toward its far end
    const wedge = canvasTexture(64, 256, (g) => {
      const h = g.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, "rgba(255,255,255,0)");
      h.addColorStop(0.5, "rgba(255,255,255,1)");
      h.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = h;
      g.beginPath();
      g.moveTo(32, 256);
      g.lineTo(0, 0);
      g.lineTo(64, 0);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "destination-in";
      const v = g.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.45, "rgba(0,0,0,0.8)");
      v.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = v;
      g.fillRect(0, 0, 64, 256);
    });
    this.textures = [spokes, shaft, wedge];

    const ray = () => new Sprite({ texture: wedge, anchor: { x: 0.5, y: 1 }, blendMode: "add", alpha: 0 });
    this.starburst = new Sprite({ texture: spokes, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.shaft = new Sprite({ texture: shaft, anchor: { x: 0.5, y: 1 }, blendMode: "add", alpha: 0, tint: 0xfff2c0 });
    this.glow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0, tint: 0xffd34d });
    this.broad = COLORS.map((c) => Object.assign(ray(), { tint: darken(c, 0.45) }));
    this.narrow = COLORS.map((c) => Object.assign(ray(), { tint: c }));
    for (let i = 0; i < SPARKLES; i++) {
      const s = new Sprite({ texture: sparkle, anchor: 0.5, blendMode: "add", alpha: 0 });
      this.sparkles.push({ s, phase: Math.random() * Math.PI * 2, rate: 2 + Math.random() * 3, placed: false });
    }
    this.root.addChild(this.starburst, this.glow, this.shaft, ...this.broad, ...this.narrow, ...this.sparkles.map((p) => p.s));
  }

  layout(screen: { w: number; h: number }, chestS: number): void {
    this.length = screen.h * 1.05;
    this.size = Math.max(screen.w, screen.h) * 1.2;
    this.starburst.width = this.starburst.height = this.size;
    this.shaft.width = 26 * chestS;
    this.shaft.height = screen.h * 1.1;
    this.glow.width = this.glow.height = 120 * chestS;
    for (const p of this.sparkles) p.placed = false;
  }

  /** `t` is null while the key waits; `at` is the chest's mouth (open) or middle (waiting). */
  update(dt: number, clock: number, t: number | null, c: VaultCues, at: Pt): void {
    this.starburst.position.set(at.x, at.y);
    this.starburst.rotation += dt * STARBURST_SPIN;
    if (t === null) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3.1);
      this.starburst.tint = 0xff3020;
      this.starburst.alpha = 0.1 + 0.05 * pulse;
      for (const s of [this.shaft, this.glow, ...this.broad, ...this.narrow, ...this.sparkles.map((p) => p.s)]) s.alpha = 0;
      return;
    }
    const celebrating = t >= VAULT_CUES.celebrateFrom;
    const fan = celebrating ? clamp01((c.rays - RESTING) / (1 - RESTING)) : c.rays;
    const charge = clamp01(t / VAULT_CUES.impact);
    this.starburst.tint = 0xffe08a;
    this.starburst.alpha = t < VAULT_CUES.impact ? 0.1 * charge : 0.12 + 0.3 * fan + (celebrating ? 0.1 : 0);
    // the impact's shaft of light, handing over to the fan
    const since = t - VAULT_CUES.impact;
    this.shaft.position.set(at.x, at.y);
    this.shaft.alpha = since >= 0 ? 0.95 * clamp01(1 - since / SHAFT_SECONDS) * (0.85 + 0.15 * Math.sin(clock * 9)) : 0;
    // the soft glow the fan becomes
    this.glow.position.set(at.x, at.y);
    this.glow.alpha = since < 0 ? 0 : celebrating ? 0.25 + 0.35 * (1 - fan) : 0.2 * c.rays;
    // the fan, sweeping slowly once the columns spin
    const sweep = SWEEP * clamp01((t - VAULT_CUES.spinFrom) / 0.5) * Math.sin(clock * 0.7);
    const rays = (list: Sprite[], half: number, alpha: number, spread: number) =>
      list.forEach((s, i) => {
        const a = -spread + ((2 * spread) / (list.length - 1)) * i;
        s.position.set(at.x, at.y);
        s.rotation = a + sweep * (i % 2 ? 1 : -0.6);
        s.height = this.length * (0.85 + 0.15 * Math.sin(clock * 1.3 + i));
        s.width = 2 * Math.tan(half) * s.height;
        s.alpha = fan * alpha * (0.8 + 0.2 * Math.sin(clock * 2.1 + i * 1.7));
      });
    rays(this.broad, BROAD, 0.9, SPREAD);
    rays(this.narrow, NARROW, 0.85, SPREAD * 0.8);
    // sparse white sparkles in the fan, each twinkling and moving on when it fades out
    for (const p of this.sparkles) {
      const before = Math.sin(p.phase);
      p.phase += dt * p.rate;
      const tw = Math.sin(p.phase);
      if (!p.placed || (before < 0 && tw >= 0)) this.place(p, at);
      p.s.alpha = fan * Math.max(0, tw) ** 3;
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
    for (const tex of this.textures) tex.destroy(true);
  }

  /** Visual-only randomness: a sparkle somewhere in the fan. */
  private place(p: Sparkle, at: Pt): void {
    const a = (Math.random() * 2 - 1) * SPREAD;
    const d = this.length * (0.15 + Math.random() * 0.7);
    p.s.position.set(at.x + Math.sin(a) * d, at.y - Math.cos(a) * d);
    p.placed = true;
    p.s.scale.set(0.6 + Math.random() * 0.8);
  }
}
