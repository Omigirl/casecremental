import { frameAt } from "./motion";

// Plays a skin's baked loop by elapsed game time (spec: animated skins §5). One player for every place a
// skin is shown — the reveal card and the landed reel card now, the locker and the claim tray later.

export class SkinPlayer<T> {
  private ms = 0;

  constructor(
    readonly frames: readonly T[],
    readonly fps: number,
  ) {}

  /** A loop of more than one frame. */
  get moving(): boolean {
    return this.frames.length > 1;
  }

  get frame(): T {
    return this.frames[frameAt(this.ms, this.fps, this.frames.length)]!;
  }

  /** Back to the first frame (a new spin shows the skin still). */
  reset(): void {
    this.ms = 0;
  }

  advance(ms: number): T {
    this.ms += ms;
    return this.frame;
  }
}
