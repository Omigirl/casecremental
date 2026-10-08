import { COMBO_HEAT_DIVISOR, HEAT_TAU_SECONDS, STAGE_HYSTERESIS, STAGE_THRESHOLDS, TIER_HEAT_BONUS } from "./tuning";

// Intensity drives the escalation from "Sober" to "Cyberpsychosis" (spec §9.1).

export const STAGE_NAMES: readonly string[] = ["Sober", "Buzzed", "High", "Tripping", "Cyberpsychosis"];

/** Exponential moving average of reveals per second. */
export function updateHeat(heat: number, reveals: number, dt: number): number {
  if (dt <= 0) return heat;
  const alpha = 1 - Math.exp(-dt / HEAT_TAU_SECONDS);
  return heat + alpha * (reveals / dt - heat);
}

export function intensityLevel(heat: number, tier: number, combo: number): number {
  return heat * (1 + TIER_HEAT_BONUS * (tier - 1)) + combo / COMBO_HEAT_DIVISOR;
}

/** Stage 1–5 for this intensity; going down needs a 20% margin so stages don't flicker. */
export function nextStage(current: number, level: number): number {
  let reached = 1;
  STAGE_THRESHOLDS.forEach((t, i) => {
    if (level >= t) reached = i + 2;
  });
  if (reached >= current) return reached;
  const keep = STAGE_THRESHOLDS[current - 2]! * STAGE_HYSTERESIS;
  return level >= keep ? current : reached;
}
