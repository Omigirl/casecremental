// Pure timing and variation for the mixer (spec §9): which variant plays, the per-play pitch and
// level jitter, the combo's rising pitch, bar-aligned music changes and equal-power crossfades, and the stage
// playlists' order and hand-overs.

/** All stage loops share this tempo and a 4/4 bar, so they can swap on bar lines. */
export const MUSIC_BPM = 120;
export const BEATS_PER_BAR = 4;

/** A random variant, never the same one twice in a row when there is a choice. */
export function pickVariant(count: number, last: number, random: () => number): number {
  if (count <= 1) return 0;
  const i = Math.floor(random() * (count - 1));
  return i >= last && last >= 0 ? i + 1 : i;
}

/** ±4 % pitch and ±2 dB level per play, so repeats never sound identical. */
export function jitter(random: () => number): { rate: number; gain: number } {
  const rate = 1 + (random() * 2 - 1) * 0.04;
  const db = (random() * 2 - 1) * 2;
  return { rate, gain: 10 ** (db / 20) };
}

/** Coins and reel ticks climb with the combo: a semitone every 4 combo, up to an octave. */
export function comboPitch(combo: number): number {
  const steps = Math.min(12, Math.max(0, combo - 1) / 4);
  return 2 ** (steps / 12);
}

export const barSeconds = (bpm = MUSIC_BPM, beats = BEATS_PER_BAR): number => (60 / bpm) * beats;

/** The first bar line at or after `now` for music that started at `startedAt`. */
export function nextBar(now: number, startedAt: number, bpm = MUSIC_BPM): number {
  const bar = barSeconds(bpm);
  if (now <= startedAt) return startedAt;
  return startedAt + Math.ceil((now - startedAt) / bar - 1e-9) * bar;
}

/** Equal-power crossfade: [outgoing, incoming] gains at progress 0..1. */
export function crossfade(progress: number): [number, number] {
  const p = Math.min(1, Math.max(0, progress));
  return [Math.cos((p * Math.PI) / 2), Math.sin((p * Math.PI) / 2)];
}

/** The loop for an intensity stage: the stage's own, else the nearest lower one that exists. */
export function musicFor(stage: number, available: readonly number[]): number | null {
  const lower = available.filter((s) => s <= stage);
  return lower.length ? Math.max(...lower) : null;
}

/** A stage loop plays this many times before its playlist moves on (finish spec §6: a 32 s loop twice, 64 s). */
export const LOOP_PLAYS = 2;
/** Stage 5's playlist takes Run 4's finale loop (finish spec §6), from this run on (Run 4's replays too). */
export const FINALE_STAGE = 5;
export const FINALE_RUN = 4;
/** The engine schedules a playlist hand-over on the audio clock this long before its bar line, so a frame's jitter
 *  never misses it. */
export const SWAP_LEAD = 0.25;

/** The loops a stage plays in `run`, in order: its own, then the finale in stage 5 from Run 4 on. */
export function playlistFor<T>(loops: readonly T[], stage: number, run: number, finale: T | null): T[] {
  return finale !== null && stage === FINALE_STAGE && run >= FINALE_RUN ? [...loops, finale] : [...loops];
}

/** When a loop that started at `startedAt` hands over: the bar line nearest the end of its LOOP_PLAYS plays (at least
 *  one bar in), so an mp3 a few ms off 32 s still swaps on the grid it started on. */
export function swapTime(startedAt: number, duration: number, plays = LOOP_PLAYS, bpm = MUSIC_BPM): number {
  const bar = barSeconds(bpm);
  return startedAt + Math.max(1, Math.round((plays * duration) / bar)) * bar;
}

/** The first playlist entry from `from` on (wrapping) whose file is ready, or null when none is: a loop that failed to
 *  decode is skipped, never left as silence. */
export function nextReady(from: number, count: number, ready: (i: number) => boolean): number | null {
  for (let k = 0; k < count; k++) {
    const i = (from + k) % count;
    if (ready(i)) return i;
  }
  return null;
}
