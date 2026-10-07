// Game-time scale for juice: a hit-stop freezes the world for a few frames (Covert drops), a
// slow-mo stretches a moment (★ drops) and ramps back to normal speed at its end.

export class TimeScale {
  private hitStopLeft = 0;
  private slow: { scale: number; left: number; ramp: number } | null = null;

  hitStop(seconds: number): void {
    this.hitStopLeft = Math.max(this.hitStopLeft, seconds);
  }

  slowMo(scale: number, seconds: number, rampSeconds: number): void {
    this.slow = { scale, left: seconds, ramp: rampSeconds };
  }

  get active(): boolean {
    return this.hitStopLeft > 0 || this.slow !== null;
  }

  /** Advances by real seconds and returns this frame's scale. */
  update(realSeconds: number): number {
    if (this.slow) this.slow.left -= realSeconds;
    if (this.hitStopLeft > 0) {
      this.hitStopLeft -= realSeconds;
      return 0;
    }
    if (!this.slow) return 1;
    if (this.slow.left <= 0) {
      this.slow = null;
      return 1;
    }
    if (this.slow.left < this.slow.ramp) {
      const k = this.slow.left / this.slow.ramp;
      return 1 + (this.slow.scale - 1) * k;
    }
    return this.slow.scale;
  }
}
