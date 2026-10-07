import { ColorMatrixFilter, type Container } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";

// The look of each intensity stage, eased over ~1 s. Stage 1 (Sober): muted colors, no glow.
// Stage 2 (Buzzed): full color and bloom. Stages 3–5 arrive in milestone 2.

export class StageLook {
  private readonly color = new ColorMatrixFilter();
  private readonly bloom = new AdvancedBloomFilter({ threshold: 0.45, bloomScale: 0, brightness: 1, blur: 6, quality: 4 });
  private sat = -0.35;
  private satTarget = -0.35;
  private bloomTarget = 0;

  constructor(target: Container) {
    target.filters = [this.color, this.bloom];
    this.apply();
  }

  setStage(stage: number): void {
    this.satTarget = stage >= 2 ? 0.15 : -0.35;
    this.bloomTarget = stage >= 2 ? 0.9 : 0;
  }

  update(dt: number): void {
    const k = Math.min(1, dt * 2);
    this.sat += (this.satTarget - this.sat) * k;
    this.bloom.bloomScale += (this.bloomTarget - this.bloom.bloomScale) * k;
    this.apply();
  }

  private apply(): void {
    this.color.reset();
    this.color.saturate(this.sat, false);
  }
}
