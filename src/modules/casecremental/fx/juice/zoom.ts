// Camera push-in for big moments (★ slow-mo, a Covert punch, stage-ups): the whole scene — pixel
// world and HD layer — scales around the reveal. The user wants the zoom ("2.5D is fine"): pixels go
// slightly uneven while it lasts and are exact again at rest. Real time, so slow-mo doesn't slow it.
//
// At stage 5 (Unhinged) a fully bought Run 4 reveals big cards every few seconds, and the ×1.3 push-in, which scales the
// panels and the HUD too, was on for 17–31 % of the frames (F9). There the camera must rest `minRest` seconds after one
// push-in before the next may start (zoomRestFor); a punch that lands while it is pushed in still extends it.

/** Seconds the camera rests between two push-ins at an intensity stage (0: no rule). */
export const zoomRestFor = (stage: number): number => (stage >= 5 ? 8 : 0);

export class Zoom {
  private value = 1;
  private target = 1;
  private hold = 0;
  /** Seconds since the camera came back to rest. */
  private rested = Infinity;
  /** The rest a push-in needs (zoomRestFor the current stage). */
  minRest = 0;

  /** Push in to `amount` (e.g. 1.3) and stay there for `holdSeconds`, then ease back out. Refused while the camera is at
   *  rest but has not rested `minRest` seconds yet. */
  punch(amount: number, holdSeconds: number): void {
    const atRest = this.target === 1 && this.hold <= 0 && this.value === 1;
    if (atRest && this.rested < this.minRest) return;
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
    const wasAtRest = this.value === 1;
    this.value += (this.target - this.value) * Math.min(1, dt * rate);
    if (this.target === 1 && Math.abs(this.value - 1) < 0.001) this.value = 1;
    if (this.value !== 1) this.rested = 0;
    else if (wasAtRest) this.rested += dt;
    else this.rested = 0; // it just came back
    return this.value;
  }
}
