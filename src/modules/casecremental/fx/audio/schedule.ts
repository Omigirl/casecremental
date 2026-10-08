// Pure timing and variation for the mixer (spec §9): which variant plays, the per-play pitch and
// level jitter, the combo's rising pitch, bar-aligned music changes and equal-power crossfades.

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
