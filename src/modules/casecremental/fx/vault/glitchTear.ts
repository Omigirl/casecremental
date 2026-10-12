import { GlitchFilter } from "pixi-filters";
import type { Filter } from "pixi.js";
import type { TearFx } from "./Finale";

/** GlitchFilter's fill mode for the gap a slice leaves: wrap the picture around (no black bars, no brightness change). */
const FILL_LOOP = 2;

/** The finale's screen tear on a GlitchFilter: slices offset sideways with a 3 px colour split (no inversion, no
 *  brightness change). Kept apart from Finale.ts so that file runs without the filter's canvas (its tests). */
export class GlitchTear implements TearFx {
  readonly filter: Filter;
  private readonly glitch = new GlitchFilter({ slices: 10, offset: 0, fillMode: FILL_LOOP, red: [3, 0], blue: [-3, 0] });

  constructor() {
    this.filter = this.glitch;
    this.glitch.enabled = false;
  }

  get enabled(): boolean {
    return this.glitch.enabled;
  }
  set enabled(on: boolean) {
    this.glitch.enabled = on;
  }
  get offset(): number {
    return this.glitch.offset;
  }
  set offset(v: number) {
    this.glitch.offset = v;
  }

  reseed(seed: number): void {
    this.glitch.seed = seed;
    this.glitch.refresh();
  }

  destroy(): void {
    this.glitch.destroy();
  }
}
