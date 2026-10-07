import { COMBO_CAP } from "../sim/tuning";

// HUD juice math: the combo tints the whole screen, cool at first and hotter as it climbs (spec §8.4).

const MAX_ALPHA = 0.16;

export function comboTint(combo: number): { hue: number; alpha: number } {
  const k = Math.min(Math.max(combo - 1, 0), COMBO_CAP - 1) / (COMBO_CAP - 1);
  return { hue: 190 - 160 * k, alpha: MAX_ALPHA * k };
}
