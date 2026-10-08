// Camera push-in for big moments (★ slow-mo, a Covert punch, stage-ups): the whole scene — pixel
// world and HD layer — scales around the reveal. The user wants the zoom ("2.5D is fine"): pixels go
// slightly uneven while it lasts and are exact again at rest. Real time, so slow-mo doesn't slow it.

export class Zoom {
  private value = 1;
  private target = 1;
  private hold = 0;

  /** Push in to `amount` (e.g. 1.3) and stay there for `holdSeconds`, then ease back out. */
  punch(amount: number, holdSeconds: number): void {
    this.target = Math.max(this.target, amount);
    this.hold = Math.max(this.hold, holdSeconds);
  }

  get level(): number {
    return this.value;
  }

  update(dt: number): number {
    if (this.hold > 0) this.hold -= dt;
    else this.target = 1;
    const rate = this.value < this.target ? 10 : 3; // snap in, ease out
    this.value += (this.target - this.value) * Math.min(1, dt * rate);
    if (this.target === 1 && Math.abs(this.value - 1) < 0.001) this.value = 1;
    return this.value;
  }
}
