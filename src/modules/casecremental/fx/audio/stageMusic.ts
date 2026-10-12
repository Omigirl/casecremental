import { barSeconds, crossfade, FINALE_RUN, musicFor, nextBar, nextReady, playlistFor, swapTime, SWAP_LEAD } from "./schedule";
import type { AudioFiles } from "./sounds";

// The stage loops (finish spec §6). Each stage plays its loops as a playlist: a loop twice, then the next, swapped on
// a bar line with a one-bar equal-power crossfade, wrapping; stage 5 takes Run 4's finale loop from Run 4 on. A stage
// change swaps to the new stage on the next bar line, and a stage starts at the loop after the one it last started,
// so coming back to a stage brings its next loop. The timing rules are pure (schedule.ts); this owns the nodes. Music
// is not saved: a reload starts the sim's stage at its first loop.

type MusicCtx = Pick<BaseAudioContext, "createGain" | "createBufferSource" | "currentTime">;
/** A decoded file, or null/undefined while it loads or after it failed to decode. */
export type BufferOf = (url: string) => AudioBuffer | null | undefined;

interface Loop {
  stage: number;
  index: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
  duration: number;
  /** The bar line where the playlist's next loop takes over. */
  swapAt: number;
}

/** Steps of the linear ramps that draw a crossfade's equal-power curve. */
const FADE_STEPS = 8;

export class StageMusic {
  private loop: Loop | null = null;
  /** The loop still fading out after a hand-over (stopped with the playing one). */
  private prev: Loop | null = null;
  /** Per stage, the playlist entry it starts on next: the one after the entry it last started. */
  private readonly cursors = new Map<number, number>();
  /** The dev sound board's audition: hold this loop, never hand over, until a stage is asked for. */
  private held = false;

  constructor(private readonly files: Pick<AudioFiles, "music" | "finale">) {}

  /** Play `stage`'s music in `run`. Already playing that stage: nothing. Else its playlist from its cursor — on the
   *  next bar line with a one-bar crossfade over a playing loop, at once with a short fade-in over silence. */
  want(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, stage: number, run: number): void {
    const list = this.playlist(stage, run);
    if (!list || (this.loop?.stage === list.stage && !this.held)) return;
    const index = nextReady(this.cursors.get(list.stage) ?? 0, list.urls.length, (i) => !!buffer(list.urls[i]!));
    if (index === null) return; // nothing decoded yet: the engine asks again when the files are in
    this.held = false;
    const at = this.loop ? nextBar(ctx.currentTime, this.loop.startedAt) : ctx.currentTime;
    this.start(ctx, bus, buffer(list.urls[index]!)!, list.stage, index, list.urls.length, at);
  }

  /** Every frame: within SWAP_LEAD of the playing loop's hand-over, schedule the playlist's next loop on that bar line
   *  (or on the next bar line from now, when the frames stopped — a hidden tab — and the hand-over went by). */
  tick(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, run: number): void {
    const l = this.loop;
    if (!l || this.held || ctx.currentTime < l.swapAt - SWAP_LEAD) return;
    this.advance(ctx, bus, buffer, run, ctx.currentTime <= l.swapAt ? l.swapAt : nextBar(ctx.currentTime, l.startedAt));
  }

  /** The dev sound board: the playlist's next loop on the next bar line. */
  skip(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, run: number): void {
    const l = this.loop;
    if (!l) return;
    this.held = false;
    this.advance(ctx, bus, buffer, run, nextBar(ctx.currentTime, l.startedAt));
  }

  /** The dev sound board: hold entry `index` of `stage`'s full playlist (stage 5 with the finale last). */
  audition(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, stage: number, index: number): void {
    const loops = this.files.music.get(stage);
    const urls = loops ? playlistFor(loops, stage, FINALE_RUN, this.files.finale) : [];
    const decoded = urls[index] ? buffer(urls[index]!) : null;
    if (!decoded) return;
    this.start(ctx, bus, decoded, stage, index, urls.length, this.loop ? nextBar(ctx.currentTime, this.loop.startedAt) : ctx.currentTime);
    this.held = true;
  }

  /** How many loops `stage`'s full playlist has (stage 5 counts the finale); 0 when it has none of its own. */
  length(stage: number): number {
    const loops = this.files.music.get(stage);
    return loops ? playlistFor(loops, stage, FINALE_RUN, this.files.finale).length : 0;
  }

  /** Fade the music out (a track takes over, the scene leaves, the engine closes). */
  stop(ctx: MusicCtx | null, fade: number): void {
    const l = this.loop;
    const fading = [this.loop, this.prev];
    this.loop = null;
    this.prev = null;
    this.held = false;
    if (!ctx) return;
    if (l && l.startedAt > ctx.currentTime) this.cursors.set(l.stage, l.index); // it never got to play: first next time
    for (const x of fading) {
      if (!x) continue;
      try {
        x.gain.gain.cancelScheduledValues(ctx.currentTime);
        x.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
        x.source.stop(ctx.currentTime + fade + 0.05);
      } catch {
        // already stopped
      }
    }
  }

  /** The stage with loops at or below `stage`, and its playlist in `run`. */
  private playlist(stage: number, run: number): { stage: number; urls: string[] } | null {
    const s = musicFor(stage, [...this.files.music.keys()]);
    return s === null ? null : { stage: s, urls: playlistFor(this.files.music.get(s)!, s, run, this.files.finale) };
  }

  /** Hand the playing loop over to its playlist's next ready loop at `at`; a playlist of one just loops on. */
  private advance(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, run: number, at: number): void {
    const l = this.loop!;
    const list = this.playlist(l.stage, run);
    const count = list?.urls.length ?? 0;
    const index = list ? nextReady((l.index + 1) % count, count, (i) => !!buffer(list.urls[i]!)) : null;
    if (!list || index === null || index === l.index) {
      l.swapAt = swapTime(l.swapAt, l.duration);
      return;
    }
    this.start(ctx, bus, buffer(list.urls[index]!)!, l.stage, index, count, at);
  }

  private start(ctx: MusicCtx, bus: GainNode, buffer: AudioBuffer, stage: number, index: number, count: number, at: number): void {
    try {
      const cur = this.loop;
      const fade = cur ? barSeconds() : 0.5;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, at);
      source.connect(gain).connect(bus);
      source.start(at);
      for (let i = 1; i <= FADE_STEPS; i++) gain.gain.linearRampToValueAtTime(crossfade(i / FADE_STEPS)[1], at + (fade * i) / FADE_STEPS);
      if (cur && cur.startedAt > ctx.currentTime) {
        // scheduled but not started (a stage change in the moment before a hand-over): it never plays, the loop
        // before it already fades out on this bar line, and it comes first when its stage is back
        cur.source.stop();
        this.cursors.set(cur.stage, cur.index);
      } else if (cur) {
        const g = cur.gain.gain;
        g.setValueAtTime(g.value, at);
        for (let i = 1; i <= FADE_STEPS; i++) g.linearRampToValueAtTime(crossfade(i / FADE_STEPS)[0], at + (fade * i) / FADE_STEPS);
        cur.source.stop(at + fade + 0.05);
        this.prev = cur;
      }
      this.cursors.set(stage, (index + 1) % count);
      this.loop = { stage, index, source, gain, startedAt: at, duration: buffer.duration, swapAt: swapTime(at, buffer.duration) };
    } catch {
      // music is optional
    }
  }
}
