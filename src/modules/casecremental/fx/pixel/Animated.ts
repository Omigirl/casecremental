import type { Actor } from "./Actor";
import { Blinker } from "./blink";
import { Timeline, type Key } from "./timeline";

// Plays timelines on an actor: an idle loop (started at a random phase, so props never sync) and
// one-shot reactions/events that return to the idle loop when they finish. Actors with code eyes
// blink on their own.

export class Animated {
  private idle: Timeline;
  private current: Timeline;
  private onEvent: ((e: string) => void) | null = null;
  private readonly blinker: Blinker | null;

  constructor(
    readonly actor: Actor,
    idle: readonly Key[],
    random: () => number = Math.random,
  ) {
    this.idle = new Timeline(idle, true);
    this.idle.advance(random() * idle.reduce((s, k) => s + k.ms, 0));
    this.current = this.idle;
    this.blinker = actor.meta.eyes ? new Blinker(random) : null;
    this.actor.show(this.current.pose);
  }

  /** Swap the idle loop (e.g. the bin gets hungry while a skin waits). */
  setIdle(keys: readonly Key[]): void {
    const playingIdle = this.current === this.idle;
    this.idle = new Timeline(keys, true);
    if (playingIdle) this.current = this.idle;
  }

  /** Play a one-shot; its events go to onEvent; then back to idle. */
  play(keys: readonly Key[], onEvent?: (e: string) => void): void {
    this.current = new Timeline(keys);
    this.onEvent = onEvent ?? null;
  }

  get busy(): boolean {
    return this.current !== this.idle;
  }

  update(ms: number): void {
    const events = this.current.advance(ms);
    for (const e of events) this.onEvent?.(e);
    if (this.current.done && this.current !== this.idle) {
      this.current = this.idle;
      this.onEvent = null;
    }
    this.actor.show(this.current.pose, this.blinker?.update(ms) ?? null);
  }
}
