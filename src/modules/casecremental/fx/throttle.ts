// A gate for an effect a machine can fire ten times a second (a stream of machine stores, a machine's sound): at most
// one per `gap` seconds of the clock it is given.

export class Throttle {
  private last = -Infinity;

  constructor(private readonly gap: number) {}

  /** True — and a new gap starts — when `now` is at least `gap` after the last one it let through. */
  ready(now: number): boolean {
    if (now - this.last < this.gap) return false;
    this.last = now;
    return true;
  }

  reset(): void {
    this.last = -Infinity;
  }
}
