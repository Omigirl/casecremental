// Vault Case I's finale (M2b spec §7): ~20 s, hands-off. It builds to everything at once — the reel
// spinning, cases raining onto the table, the bot frenzied, flashes, the top stage's look and music —
// then falls silent just before the vault opens on its one legendary drop.

/** Where the noise stops (share of FINALE_SECONDS). */
export const FINALE_SILENCE_AT = 0.85;
/** One spin of the reel during the finale, seconds. */
export const FINALE_SPIN_SECONDS = 1.8;
export const FINALE_COLORS = [0xff7ad9, 0x7affc1, 0xffd34d, 0x6ab0ff] as const;

export interface FinaleKnobs {
  phase: "build" | "silence";
  /** 0 → 1 over the build. */
  intensity: number;
  rainPerSecond: number;
  /** Shake trauma added per second. */
  shakePerSecond: number;
  /** Seconds between flashes. */
  flashEvery: number;
}

export function finaleKnobs(p: number): FinaleKnobs {
  if (p >= FINALE_SILENCE_AT) return { phase: "silence", intensity: 0, rainPerSecond: 0, shakePerSecond: 0, flashEvery: Infinity };
  const i = Math.min(1, Math.max(0, p / FINALE_SILENCE_AT));
  return { phase: "build", intensity: i, rainPerSecond: 2 + 18 * i, shakePerSecond: 0.3 + 1.2 * i, flashEvery: 1.6 - 1.2 * i };
}
