import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import type { Pt } from "../pixel/layout";
import { barPulse, beatAt, beatPulse, VAULT_BPM } from "./beat";
import { itemJitter } from "./beamStream";
import { chaosBeat, chaosLevels, introPunch, kickPulse, type ChaosLevels } from "./chaosPlan";
import { VAULT_CUES } from "./cues";
import { canvasTexture } from "./textures";

// The vault's chaos layer (plan M2b-C6, "no space on screen which is not moving"): before the drop, only a punch in
// on each of the intro's run-up hits; then the camera shaking on every beat of the fanfare, harder on the bars and
// punching in on every kick; the backdrop swaying; the room behind wobbling to the bar; hue-cycling stripes
// scrolling across the whole screen; coins, pixel stars and confetti raining across its width; sparks bursting in
// from both edges on the bars. Everything here is behind the rewards and their labels, and every position is a
// function of the sim's t (chaosLevels, the beat's pulses, a hash per sprite), so a reload lands on the same frame
// and nothing replays. The sprites are pooled at construction; a frame allocates none.

/** Rain sprites: coins, pixel stars and confetti in turn. */
const RAIN = 96;
/** Side sparks per screen edge, each bar. */
const EDGE_SPARKS = 22;
const BAR_SECONDS = (4 * 60) / VAULT_BPM;
const SPARK_LIFE = 0.9;
/** The backdrop's slow sway, at most this far either way, over two bars. */
const SWAY = (1.5 * Math.PI) / 180;
/** The camera's shake (in shake units) on a beat, a bar and a kick, and its constant buzz. */
const SHAKE_BEAT = 1;
const SHAKE_BAR = 2;
const SHAKE_KICK = 2.5;
const BUZZ = 0.5;
/** The zoom punch on a kick, and the beams' width pulse on a beat (scale about the chest's mouth). */
const PUNCH_KICK = 0.05;
const PUNCH_BEAT = 0.025;
/** The zoom punch on an intro run-up hit (before the drop, the chaos's levels are 0). */
const PUNCH_INTRO = 0.04;
/** The labels' and the total's wobble (screen px): readable, a tremor only. */
const WOBBLE_PX = 2;
/** The landed icons' bob on the beat (screen px), at most. */
const BOB_PX = 3;
const COIN_FPS = 14;
/** Off-screen margin the rain falls from and to (screen px, in shake units). */
const RAIN_MARGIN = 12;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** A fixed per-sprite random in [0, 1): the same every frame and after a reload. */
const rnd = (i: number, salt: number) => (itemJitter(salt, i) + 1) / 2;

/** A colour around the wheel: h in turns, s and v 0-1. Allocation-free (it runs ~100 times a frame). */
export function hsv(h: number, s: number, v: number): number {
  const h6 = (((h % 1) + 1) % 1) * 6;
  return (channel(5, h6, s, v) << 16) | (channel(3, h6, s, v) << 8) | channel(1, h6, s, v);
}

/** One 0-255 channel of hsv() (n: 5 red, 3 green, 1 blue; h6: the hue in sixths). */
function channel(n: number, h6: number, s: number, v: number): number {
  const k = (n + h6) % 6;
  return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
}

/** A still point (the scene's px, unshaken) in the shaking stage's own px: a burst spawned there shows exactly on
 *  the point now, however the stage is shaken and punched in about its pivot. */
export function intoStage(p: Pt, stage: { pivot: Pt; position: Pt; scale: number }): Pt {
  return {
    x: stage.pivot.x + (p.x - stage.position.x) / stage.scale,
    y: stage.pivot.y + (p.y - stage.position.y) / stage.scale,
  };
}

export interface ChaosArt {
  dot: Texture;
  star: Texture;
  coins: readonly Texture[];
}

export class VaultChaos {
  /** Behind the beams: the stripes, then whatever the scene adds (the starburst); sways, zooms and shakes. */
  readonly backdrop = new Container();
  /** The beams, the sky's particles and the rain (the scene adds them): shakes on the beat and punches in
   *  about the chest's mouth on the kicks — the beams fan from there, so the punch only widens them. */
  readonly stage = new Container();
  /** Coins, stars, confetti and the edge sparks: the scene puts it on the stage, in front of the sky's particles. */
  readonly rain = new Container();
  /** The room behind the vault (the World's scene): an offset and a zoom on its camera; identity while away. */
  readonly room = { x: 0, y: 0, zoom: 1 };
  /** The labels' and the total's tremor (whole screen px, |·| ≤ 2). */
  readonly wobble = { x: 0, y: 0 };
  /** The landed icons' bob (whole screen px, up on the beat). */
  bob = 0;
  /** The beat's pulse at the chaos's current strength (0-1): the chest's bounce, the starburst's, the total's. */
  beat = 0;
  /** The chaos's overall strength now (0-1). */
  level = 0;
  /** The beams' shimmer (a tint within their warm palette). */
  shimmer = 0xffffff;

  private readonly stripes: TilingSprite;
  private readonly stripeTex: Texture;
  private readonly drops: Sprite[] = [];
  private readonly sparks: Sprite[] = [];
  private screen = { w: 1, h: 1 };
  /** Screen px per shake unit (half the world's scale). */
  private u = 1;
  private coinScale = 1;
  private starScale = 0.25;

  constructor(private readonly art: ChaosArt) {
    // diagonal bands, crisp
    this.stripeTex = canvasTexture(32, 32, (g) => {
      g.fillStyle = "#fff";
      for (let d = -32; d < 64; d += 16) for (let y = 0; y < 32; y++) g.fillRect(d + y, y, 6, 1);
    });
    this.stripeTex.source.scaleMode = "nearest";
    this.stripes = new TilingSprite({ texture: this.stripeTex, width: 1, height: 1 });
    this.stripes.blendMode = "add";
    this.backdrop.addChild(this.stripes);
    for (let i = 0; i < RAIN; i++)
      this.drops.push(this.pooled(i % 3 === 0 ? art.coins[0]! : i % 3 === 1 ? art.star : Texture.WHITE, this.rain));
    for (let i = 0; i < 2 * EDGE_SPARKS; i++) {
      const s = this.pooled(i % 2 ? art.star : art.dot, this.rain);
      s.blendMode = "add";
      this.sparks.push(s);
    }
    this.reset();
  }

  layout(screen: { w: number; h: number }, k: number): void {
    this.screen = screen;
    this.u = Math.max(1, k / 2);
    this.coinScale = Math.max(1, Math.round(k * 0.6));
    this.starScale = Math.max(1, Math.round(k / 2)) / 4; // the star texture's pixel is 4 px
    // big enough to stay over the whole screen at the sway, the zoom and the shake
    const side = Math.ceil(Math.hypot(screen.w, screen.h) * 1.15);
    this.stripes.width = this.stripes.height = side;
    this.stripes.position.set(Math.round((screen.w - side) / 2), Math.round((screen.h - side) / 2));
    this.stripes.tileScale.set(Math.max(1, Math.round(k / 2)) * 2);
  }

  /** The chaos at sim time t (null while the key waits or the vault is away: all still). `mouth`: the chest's. */
  update(t: number | null, mouth: Pt): void {
    if (t === null) return this.reset();
    const L = chaosLevels(t);
    const beat = beatPulse(t);
    const bar = barPulse(t);
    const kick = kickPulse(t);
    this.level = L.shake;
    this.beat = chaosBeat(t);
    this.camera(t, L, beat, bar, kick, mouth);
    this.backdropLook(t, L, beat);
    this.rainAt(t, L.rain);
    this.edgeSparks(t, L.sparks);
  }

  /** A still point (the scene's px) where a burst on the stage must spawn to show on it (the landing fireworks). */
  toStage(p: Pt): Pt {
    const s = this.stage;
    return intoStage(p, { pivot: s.pivot, position: s.position, scale: s.scale.x });
  }

  /** Nothing moves: the vault is away, or the key still waits. */
  reset(): void {
    this.room.x = this.room.y = 0;
    this.room.zoom = 1;
    this.wobble.x = this.wobble.y = 0;
    this.bob = this.beat = this.level = 0;
    this.shimmer = 0xffffff;
    this.backdrop.pivot.set(0, 0);
    this.backdrop.position.set(0, 0);
    this.backdrop.rotation = 0;
    this.backdrop.scale.set(1);
    this.stage.pivot.set(0, 0);
    this.stage.position.set(0, 0);
    this.stage.scale.set(1);
    this.stripes.visible = false;
    for (const s of this.drops) s.visible = false;
    for (const s of this.sparks) s.visible = false;
  }

  destroy(): void {
    this.stripeTex.destroy(true);
  }

  private pooled(tex: Texture, into: Container): Sprite {
    const s = new Sprite({ texture: tex, anchor: 0.5 });
    s.visible = false;
    into.addChild(s);
    return s;
  }

  /** The beat-locked shake (a fresh direction each beat), the kick's and the intro run-up's punch, the sway, the
   *  room's wobble. */
  private camera(t: number, L: ChaosLevels, beat: number, bar: number, kick: number, mouth: Pt): void {
    const u = this.u;
    const dir = itemJitter(0x5eed, Math.floor(beatAt(t))) * Math.PI;
    const amp = L.shake * u * (SHAKE_BEAT * beat + SHAKE_BAR * bar + SHAKE_KICK * kick);
    const sx = Math.round(Math.cos(dir) * amp + L.shake * u * BUZZ * Math.sin(t * 43.1));
    const sy = Math.round(Math.sin(dir) * amp + L.shake * u * BUZZ * Math.cos(t * 37.7));
    const punch = L.zoom * (PUNCH_KICK * kick + PUNCH_BEAT * beat) + PUNCH_INTRO * introPunch(t);

    this.stage.pivot.set(mouth.x, mouth.y);
    this.stage.position.set(mouth.x + sx, mouth.y + sy);
    this.stage.scale.set(1 + punch);

    const cx = this.screen.w / 2;
    const cy = this.screen.h / 2;
    this.backdrop.pivot.set(cx, cy);
    this.backdrop.position.set(cx + Math.round(sx * 1.5), cy + Math.round(sy * 1.5));
    this.backdrop.rotation = L.shake * SWAY * Math.sin((Math.PI * t) / BAR_SECONDS);
    this.backdrop.scale.set(1 + L.background * (0.03 + 0.04 * bar) + punch);

    this.room.x = Math.round(L.background * u * 3 * Math.sin(t * 2.3)) + sx;
    this.room.y = Math.round(L.background * u * 2 * Math.cos(t * 1.7)) + sy;
    this.room.zoom = 1 + L.background * (0.02 + 0.05 * bar) + punch / 2;

    this.wobble.x = Math.round(WOBBLE_PX * L.wobble * Math.sin(t * 7.3));
    this.wobble.y = Math.round(WOBBLE_PX * L.wobble * Math.sin(t * 5.1 + 1));
    this.bob = -Math.round(Math.min(BOB_PX, u) * L.wobble * beat);
  }

  /** The stripes scrolling and cycling hue, brighter on the beat; the beams' shimmer. */
  private backdropLook(t: number, L: ChaosLevels, beat: number): void {
    this.stripes.visible = L.background > 0;
    this.stripes.tint = hsv(t * 0.17, 0.85, 1);
    this.stripes.alpha = L.background * (0.06 + 0.07 * beat);
    const scroll = t * 40 * this.u;
    this.stripes.tilePosition.set(scroll, scroll * 0.5);
    // a warm shimmer: yellow beams lean orange, orange ones red, red stays red
    this.shimmer = hsv(0.02 + 0.06 * (0.5 + 0.5 * Math.sin(t * 5.3)), 0.35 * L.hue, 1);
  }

  /** Coins, stars and confetti falling across the whole width, pouring in from the top after the impact. */
  private rainAt(t: number, level: number): void {
    const { w, h } = this.screen;
    const margin = RAIN_MARGIN * this.u;
    const span = h + 2 * margin;
    const coins = this.art.coins;
    for (let i = 0; i < RAIN; i++) {
      const s = this.drops[i]!;
      const kind = i % 3;
      const r1 = rnd(i, 11);
      const r2 = rnd(i, 23);
      const r3 = rnd(i, 37);
      const speed = h * (kind === 0 ? 0.55 + 0.35 * r2 : 0.25 + 0.3 * r2);
      const travel = (t - VAULT_CUES.impact) * speed - r3 * span * 0.6;
      const show = clamp01(level * RAIN - i);
      s.visible = show > 0 && travel >= 0;
      if (!s.visible) continue;
      const y = (travel % span) - margin;
      const x = r1 * w + (kind === 0 ? 0 : Math.sin(t * (1 + 2 * r2) + r3 * 6.28) * 10 * this.u);
      s.position.set(Math.round(x), Math.round(y));
      s.alpha = show;
      if (kind === 0) {
        s.texture = coins[(Math.floor(t * COIN_FPS) + i) % coins.length]!;
        s.scale.set(this.coinScale);
      } else if (kind === 1) {
        s.scale.set(this.starScale * (1 + Math.round(r2)));
        s.tint = hsv(r1 + t * 0.3, 0.55, 1);
        s.alpha = show * (0.6 + 0.4 * Math.sin(t * 9 + r3 * 6.28));
      } else {
        const cw = 2 * this.u;
        s.scale.set(cw * Math.cos(t * (4 + 6 * r3) + r1 * 6.28), cw * 1.8);
        s.rotation = t * (2 + 4 * r2) * (r3 < 0.5 ? -1 : 1);
        s.tint = hsv(r1 + t * 0.25, 0.8, 1);
      }
    }
  }

  /** On each bar, a spray of sparks bursting in from both screen edges, at a height that changes every bar. */
  private edgeSparks(t: number, level: number): void {
    const bars = beatAt(t) / 4;
    const since = (bars - Math.floor(bars)) * BAR_SECONDS;
    const live = level > 0 && bars >= 0 && since < SPARK_LIFE;
    const n = Math.floor(bars);
    const { w, h } = this.screen;
    const v = this.u * 2;
    const fade = 1 - since / SPARK_LIFE;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]!;
      s.visible = live;
      if (!live) continue;
      const side = i < EDGE_SPARKS ? 1 : -1; // the left edge sprays right, the right edge left
      const fromX = side > 0 ? 0 : w;
      const fromY = h * (0.15 + 0.6 * rnd(n, side > 0 ? 3 : 5));
      const a = (rnd(i, n) - 0.5) * 1.6 - 0.35; // up and across, fanned
      const speed = v * (80 + 220 * rnd(i, n + 7));
      const vx = side * Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      s.position.set(Math.round(fromX + vx * since), Math.round(fromY + vy * since + 150 * v * since * since));
      s.scale.set((0.5 + rnd(i, 9)) * (0.6 + 0.4 * fade) * (i % 2 ? this.starScale * 2 : 0.5 * this.u));
      s.tint = hsv(rnd(n, 1) + i * 0.02 + t * 0.2, 0.7, 1);
      s.alpha = level * fade;
    }
  }
}
