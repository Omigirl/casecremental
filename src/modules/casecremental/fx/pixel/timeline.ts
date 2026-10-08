// Per-frame-timed animation (spec §6): each key holds a drawn frame for its own duration, with
// whole-pixel nudges (dx/dy for the whole sprite, bodyDy/headDy for the bands), an eye state, a
// look offset and an optional event fired when the key starts.

export type EyeState = "open" | "half" | "closed" | "happy";

export interface Key {
  frame: number;
  ms: number;
  dx?: number;
  dy?: number;
  bodyDy?: number;
  headDy?: number;
  eyes?: EyeState;
  look?: number;
  event?: string;
}

export interface Pose {
  frame: number;
  dx: number;
  dy: number;
  bodyDy: number;
  headDy: number;
  eyes: EyeState;
  look: number;
}

export class Timeline {
  private i = 0;
  private t = 0;
  private started = false;
  private finished = false;

  constructor(
    private readonly keys: readonly Key[],
    readonly loop = false,
  ) {
    if (keys.length === 0) throw new Error("timeline needs at least one key");
  }

  get done(): boolean {
    return this.finished;
  }

  get pose(): Pose {
    const k = this.keys[this.i]!;
    return {
      frame: k.frame,
      dx: k.dx ?? 0,
      dy: k.dy ?? 0,
      bodyDy: k.bodyDy ?? 0,
      headDy: k.headDy ?? 0,
      eyes: k.eyes ?? "open",
      look: k.look ?? 0,
    };
  }

  restart(): void {
    this.i = 0;
    this.t = 0;
    this.started = false;
    this.finished = false;
  }

  /** Advance by ms; returns the events of every key entered (including the first, on the first call). */
  advance(ms: number): string[] {
    const events: string[] = [];
    if (!this.started) {
      this.started = true;
      const e = this.keys[0]!.event;
      if (e) events.push(e);
    }
    if (this.finished) return events;
    this.t += ms;
    while (this.t >= this.keys[this.i]!.ms) {
      this.t -= this.keys[this.i]!.ms;
      if (this.i + 1 < this.keys.length) this.i++;
      else if (this.loop) this.i = 0;
      else {
        this.finished = true;
        this.t = 0;
        break;
      }
      const e = this.keys[this.i]!.event;
      if (e) events.push(e);
    }
    return events;
  }
}
