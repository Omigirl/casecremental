import { ColorMatrixFilter, Container, type Filter, type Sprite } from "pixi.js";
import { AdvancedBloomFilter, BulgePinchFilter, GlitchFilter } from "pixi-filters";
import type { RunState } from "../../sim/run";
import type { HdLayer } from "../hd/HdLayer";
import { FILL_LOOP } from "../vault/glitchTear";
import { bloomActive, lookFor } from "./look";
import { SpritePool } from "./spritePool";
import { GLITCH_SECONDS, nextGlitchAt, rainCount, stageFiveMix, STROBE_STRENGTH, strobeDue, warpAt } from "./stageFive";

// The look of each intensity stage, eased over ~1 s. Stage 1 (Sober): muted colors, no glow. Stage 2 (Buzzed): full
// color and bloom; stages 3–4 keep stage 2's look. Stage 5 (Unhinged) adds its layers (stageFive.ts): the screen
// breathes in a slow warp, gold coins rain by the heat, glitch bursts slice the screen now and then, and a soft strobe
// marks every four beats. The strobe and every burst ask the flash gate; none of it shows while the vault is out.

/** Rain speed range, screen px a second at scale 4. */
const RAIN_SPEED: readonly [number, number] = [120, 220];

interface Drop {
  s: Sprite;
  v: number;
}

/** The filters the look drives, in the order they apply (stageLookFilters() makes the real ones; a test passes fakes,
 *  since a filter needs a GPU context to be made). */
export interface StageLookFilters {
  readonly color: ColorMatrixFilter;
  readonly bloom: AdvancedBloomFilter;
  readonly warp: BulgePinchFilter;
  readonly glitch: GlitchFilter;
}

export const stageLookFilters = (): StageLookFilters => ({
  color: new ColorMatrixFilter(),
  bloom: new AdvancedBloomFilter({ threshold: 0.45, bloomScale: 0, brightness: 1, blur: 6, quality: 4 }),
  warp: new BulgePinchFilter({ center: { x: 0.5, y: 0.5 }, radius: 0, strength: 0 }),
  // the gap a slice leaves wraps the picture round: no dark bars, no change in brightness (photosensitivity)
  glitch: new GlitchFilter({ slices: 6, offset: 0, fillMode: FILL_LOOP, red: [2, 0], blue: [-2, 0] }),
});

export class StageLook {
  private readonly color: ColorMatrixFilter;
  private readonly bloom: AdvancedBloomFilter;
  private readonly warp: BulgePinchFilter;
  private readonly glitch: GlitchFilter;
  private readonly rain = new Container();
  private readonly pool: SpritePool;
  private drops: Drop[] = [];
  private sat = -0.35;
  private satTarget = -0.35;
  private bloomTarget = 0;
  /** How much of stage 5's layers shows, and their own clock (it runs only while they show). */
  private mix = 0;
  private t = 0;
  private glitchLeft = 0;
  private nextGlitch = nextGlitchAt(0, Math.random());

  /** Appends its filters to `target`'s, once: after this only their `enabled` and uniforms change, so a filter added
   *  later (the Finale's tear) stays last. The rain goes into the HD layer over what it holds so far — the World makes
   *  the look before it adds the labels, cards and stations, so the coins fall under those. */
  constructor(
    private readonly target: Container,
    private readonly hd: HdLayer,
    filters: StageLookFilters = stageLookFilters(),
  ) {
    ({ color: this.color, bloom: this.bloom, warp: this.warp, glitch: this.glitch } = filters);
    this.warp.enabled = this.glitch.enabled = false;
    target.filters = [...(target.filters ?? []), ...this.filters()];
    this.pool = new SpritePool(hd.coinFrames[0]!);
    hd.root.addChild(this.rain);
    this.apply();
  }

  destroy(): void {
    const mine = this.filters();
    this.target.filters = (this.target.filters ?? []).filter((f) => !mine.includes(f));
    for (const f of mine) f.destroy();
    for (const d of this.drops) this.pool.release(d.s);
    this.drops = [];
    this.pool.destroy();
    this.rain.destroy();
  }

  private filters(): Filter[] {
    return [this.color, this.bloom, this.warp, this.glitch];
  }

  setStage(stage: number): void {
    const look = lookFor(stage);
    this.satTarget = look.saturation;
    this.bloomTarget = look.bloom;
  }

  update(dt: number, s: Pick<RunState, "stage" | "heat" | "vault">): void {
    const k = Math.min(1, dt * 2);
    this.sat += (this.satTarget - this.sat) * k;
    this.bloom.bloomScale += (this.bloomTarget - this.bloom.bloomScale) * k;
    this.apply();
    this.mix = stageFiveMix(this.mix, s.stage, s.vault !== null, dt);
    const prev = this.t;
    if (this.mix > 0) this.t += dt;
    const { w, h } = this.hd.screen;
    this.warp.enabled = this.mix > 0.01;
    this.warp.strength = warpAt(this.t, this.mix);
    this.warp.radius = Math.min(w, h) / 1.6;
    this.updateRain(dt, rainCount(s.heat, this.mix), w, h);
    if (this.mix > 0.5 && strobeDue(prev, this.t)) this.hd.flash(0xffffff, STROBE_STRENGTH); // through the gate
    this.updateGlitch(dt);
  }

  /** Coins falling across the screen: spawned at the top while fewer than `want` fall, let go once off the bottom. */
  private updateRain(dt: number, want: number, w: number, h: number): void {
    const scale = this.hd.scale;
    if (this.drops.length < want) {
      const s = this.pool.take();
      s.anchor.set(0.5);
      s.scale.set(scale / 2);
      s.alpha = 0.7;
      s.position.set(Math.random() * w, -12 * scale);
      this.rain.addChild(s);
      this.drops.push({ s, v: (RAIN_SPEED[0] + Math.random() * (RAIN_SPEED[1] - RAIN_SPEED[0])) * (scale / 4) });
    }
    const frames = this.hd.coinFrames;
    this.drops = this.drops.filter((d) => {
      d.s.y += d.v * dt;
      d.s.texture = frames[Math.floor((this.t * 10 + d.s.x) % frames.length)]!;
      if (d.s.y < h + 12 * scale) return true;
      this.pool.release(d.s);
      return false;
    });
    while (this.drops.length > want + 8) this.pool.release(this.drops.pop()!.s); // the layer went out: let the extra go
  }

  /** A glitch burst every 3–6 s once the layers are mostly in, each asking the flash gate first. */
  private updateGlitch(dt: number): void {
    this.glitchLeft = Math.max(0, this.glitchLeft - dt);
    this.glitch.enabled = this.glitchLeft > 0;
    if (this.mix <= 0.5 || this.t < this.nextGlitch) return;
    this.nextGlitch = nextGlitchAt(this.t, Math.random()); // visual-only randomness; a refused burst waits for the next
    if (!this.hd.takeFlash()) return;
    const scale = this.hd.scale;
    this.glitch.offset = 6 * scale;
    this.glitch.red = { x: 2 * scale, y: 0 };
    this.glitch.blue = { x: -2 * scale, y: 0 };
    this.glitch.seed = Math.random();
    this.glitch.refresh();
    this.glitchLeft = GLITCH_SECONDS;
    this.glitch.enabled = true;
  }

  private apply(): void {
    this.bloom.enabled = bloomActive(this.bloom.bloomScale);
    this.color.reset();
    this.color.saturate(this.sat, false);
  }
}
