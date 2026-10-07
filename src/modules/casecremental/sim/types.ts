// Shared vocabulary of the simulation. Pure data — no DOM, Pixi or React anywhere under sim/.

export type RarityId = "milspec" | "restricted" | "classified" | "covert" | "gold";
export type WearId = "FN" | "MW" | "FT" | "WW" | "BS";
export type WeaponId =
  | "rifle"
  | "sniper"
  | "pistol"
  | "heavyPistol"
  | "smg"
  | "shotgun"
  | "mg"
  | "knife";
export type PatternKind =
  | "camo"
  | "digital"
  | "tiger"
  | "leaves"
  | "bark"
  | "moss"
  | "marble"
  | "granite"
  | "crystal"
  | "lava";

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
