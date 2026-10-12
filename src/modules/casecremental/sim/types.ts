// Shared vocabulary of the simulation. Pure data — no DOM, Pixi or React anywhere under sim/.

export type RarityId = "milspec" | "restricted" | "classified" | "covert" | "gold";
export type WearId = "FN" | "MW" | "FT" | "WW" | "BS";
export type WeaponId = "rifle" | "sniper" | "pistol" | "heavyPistol" | "smg" | "shotgun" | "mg" | "knife";
export type PatternKind =
  // cases 1-3
  | "camo"
  | "digital"
  | "tiger"
  | "leaves"
  | "bark"
  | "moss"
  | "marble"
  | "granite"
  | "crystal"
  | "lava"
  // Mainframe
  | "circuit"
  | "hex"
  | "carbon"
  // Neon Nights
  | "synthgrid"
  | "neonline"
  | "hueflow"
  // Deep Space
  | "starfield"
  | "nebula"
  | "aurora"
  | "iridescent";

/** A moving finish (spec: animated skins §4; `rise`: M3 spec §3). */
export type PatternMotion = "flow" | "shimmer" | "pulse" | "sparkle" | "rise";
/** A moving weapon: the code-drawn silhouette is transformed before it is rasterised. */
export type WeaponMotion = "bob" | "recoil" | "bolt" | "flip";

/** Presentation only — the sim never reads it. */
export interface SkinMotion {
  pattern?: PatternMotion;
  weapon?: WeaponMotion;
  /** Frames in the loop (default 8). */
  frames?: number;
  /** Playback speed (default 8). */
  fps?: number;
}

export interface PatternSpec {
  kind: PatternKind;
  /** '#rrggbb' colors, darkest first. */
  palette: readonly string[];
  /** Feature density: higher = smaller blobs. */
  scale: number;
  seed: number;
}

export interface SkinDef {
  id: string;
  /** Finish name, shown as "<weapon> | <name>". */
  name: string;
  weapon: WeaponId;
  rarity: RarityId;
  pattern: PatternSpec;
  /** Optional animation, baked into a short loop of pixel frames. */
  motion?: SkinMotion;
}

export interface CaseDef {
  id: string;
  name: string;
  theme: string;
  /** 1-based position in the case ladder. */
  tier: number;
  /** Case body color, '#rrggbb'. */
  color: string;
  skins: readonly SkinDef[];
}

export interface Drop {
  id: number;
  caseId: string;
  skinId: string;
  rarity: RarityId;
  float: number;
  wear: WearId;
  statTrak: boolean;
  /** Base value before sell multipliers (Appraiser, combo). */
  value: number;
}
