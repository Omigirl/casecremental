import type { EyeState } from "./timeline";

// Eyes blink every 2–5 s (spec §6): half → closed → half, ~150 ms. While a blink runs it
// overrides the animation's own eye state.

const SEQUENCE: Array<[EyeState, number]> = [["half", 40], ["closed", 70], ["half", 40]];

export class Blinker {
  private wait: number;
  private t = 0;

  constructor(private readonly random: () => number = Math.random) {
    this.wait = this.nextWait();
  }

  /** Advance by ms; the eye state to show instead of the pose's, or null. */
  update(ms: number): EyeState | null {
    this.t += ms;
    if (this.t < this.wait) return null;
    let into = this.t - this.wait;
    for (const [state, dur] of SEQUENCE) {
      if (into < dur) return state;
      into -= dur;
    }
    this.t = 0;
    this.wait = this.nextWait();
    return null;
  }

  private nextWait(): number {
    return 2000 + this.random() * 3000;
  }
}
