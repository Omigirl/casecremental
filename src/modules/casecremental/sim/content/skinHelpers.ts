import type { PatternSpec, RarityId, SkinDef, SkinMotion, WeaponId } from "../types";

// Shared by every case table (casesRun1/2/3) and the vault legends.

export const skin = (id: string, name: string, weapon: WeaponId, rarity: RarityId, pattern: PatternSpec, motion?: SkinMotion): SkinDef => ({
  id,
  name,
  weapon,
  rarity,
  pattern,
  ...(motion ? { motion } : {}),
});

/** The ★ knives of cases 1–3 shimmer and spin. Everything else in those cases stays still. */
export const KNIFE_MOTION: SkinMotion = { pattern: "shimmer", weapon: "flip", fps: 5 };

export const p = (kind: PatternSpec["kind"], palette: string[], scale: number, seed: number): PatternSpec => ({
  kind,
  palette,
  scale,
  seed,
});
