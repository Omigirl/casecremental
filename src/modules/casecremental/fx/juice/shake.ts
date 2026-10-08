import type { Pt as Point } from "../pixel/layout";

// Trauma-based screen shake: events add trauma (0..1), the offset grows with trauma² and the
// trauma decays linearly — small hits barely move, big ones rattle.

export class Shake {
  private trauma = 0;

  constructor(
    private readonly rng: () => number = Math.random,
    private readonly maxOffset = 18,
    private readonly decayPerSecond = 1.6,
  ) {}

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get level(): number {
    return this.trauma;
  }

  update(seconds: number): Point {
    const k = this.maxOffset * this.trauma * this.trauma;
    this.trauma = Math.max(0, this.trauma - this.decayPerSecond * seconds);
    return { x: (this.rng() * 2 - 1) * k, y: (this.rng() * 2 - 1) * k };
  }
}
