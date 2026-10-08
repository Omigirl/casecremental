import { CASE_ECONOMY } from "../tuning";
import type { CaseDef, PatternSpec, RarityId, SkinDef, SkinMotion, WeaponId } from "../types";
import { WEAPON_NAMES } from "./weapons";

// The case ladder. Each later case uses a richer pattern technique than the one before it, so its
// cheapest skins already outshine the previous case's best (spec §4.3, §5). Milestone 1: cases 1–3.

const skin = (id: string, name: string, weapon: WeaponId, rarity: RarityId, pattern: PatternSpec, motion?: SkinMotion): SkinDef => ({
  id,
  name,
  weapon,
  rarity,
  pattern,
  ...(motion ? { motion } : {}),
});

/** The ★ knives are rare: they shimmer and spin. Everything else in cases 1–3 stays still. */
const KNIFE_MOTION: SkinMotion = { pattern: "shimmer", weapon: "flip" };

const p = (kind: PatternSpec["kind"], palette: string[], scale: number, seed: number): PatternSpec => ({ kind, palette, scale, seed });

const bootcamp: CaseDef = {
  id: "bootcamp",
  name: "Boot Camp Case",
  theme: "army",
  tier: 1,
  color: "#4b5320",
  skins: [
    skin("bc_woodland", "Woodland Drill", "rifle", "milspec", p("camo", ["#2f3a1f", "#4b5320", "#6b7a3a", "#8a7f5a"], 4, 11)),
    skin("bc_desert", "Sandstorm", "pistol", "milspec", p("camo", ["#8b7355", "#b39b6b", "#d2c08f"], 3, 12)),
    skin("bc_urban", "Concrete Jungle", "smg", "milspec", p("camo", ["#3d3d3d", "#6e6e6e", "#a0a0a0"], 5, 13)),
    skin("bc_olive", "Olive Drab", "shotgun", "milspec", p("camo", ["#3b4a2a", "#55663a", "#2a2f1f"], 3, 14)),
    skin("bc_snow", "Whiteout", "mg", "milspec", p("camo", ["#c9d1d9", "#eef2f5", "#9aa5b1"], 4, 15)),
    skin("bc_digital", "Pixel Patrol", "rifle", "restricted", p("digital", ["#283618", "#606c38", "#a3b18a", "#dda15e"], 6, 21)),
    skin("bc_tiger", "Jungle Cat", "smg", "restricted", p("tiger", ["#d4a017", "#1b1b1b", "#8b5a00"], 3, 22)),
    skin("bc_navy", "Deep Ops", "heavyPistol", "restricted", p("digital", ["#0b1d3a", "#1f3b73", "#4a6fa5"], 7, 23)),
    skin("bc_redalert", "Red Alert", "sniper", "classified", p("tiger", ["#2b0000", "#b3001b", "#ff4d4d"], 4, 31)),
    skin("bc_hunter", "Blaze Hunter", "shotgun", "classified", p("digital", ["#1a1a1a", "#ff6a00", "#ffd000"], 8, 32)),
    skin("bc_commander", "Commander's Pride", "rifle", "covert", p("camo", ["#111111", "#c9a227", "#f2e394", "#4b5320"], 5, 41)),
    skin("bc_warlord", "Warlord", "sniper", "covert", p("tiger", ["#0d0d0d", "#e10600", "#f5f5f5"], 5, 42)),
    skin("bc_knife", "Field Marshal", "knife", "gold", p("digital", ["#3a2f0b", "#c9a227", "#ffe08a", "#fff6d5"], 9, 51), KNIFE_MOTION),
  ],
};

const wildwood: CaseDef = {
  id: "wildwood",
  name: "Wildwood Case",
  theme: "forest",
  tier: 2,
  color: "#2d5a27",
  skins: [
    skin("ww_fern", "Fernlight", "pistol", "milspec", p("leaves", ["#1b4332", "#2d6a4f", "#52b788"], 4, 111)),
    skin("ww_bark", "Old Bark", "rifle", "milspec", p("bark", ["#3e2723", "#5d4037", "#8d6e63"], 4, 112)),
    skin("ww_moss", "Mossback", "smg", "milspec", p("moss", ["#1e3d1a", "#4f772d", "#90a955"], 5, 113)),
    skin("ww_pine", "Pine Needle", "shotgun", "milspec", p("leaves", ["#0b2e1f", "#1a4d2e", "#4f6f52"], 6, 114)),
    skin("ww_birch", "Birchwood", "mg", "milspec", p("bark", ["#d8d3c4", "#f3efe0", "#2b2b2b"], 3, 115)),
    skin("ww_autumn", "Autumn Fall", "rifle", "restricted", p("leaves", ["#6a040f", "#d00000", "#f48c06", "#ffba08"], 5, 121)),
    skin("ww_lichen", "Lichen", "heavyPistol", "restricted", p("moss", ["#2f3e46", "#84a98c", "#cad2c5"], 7, 122)),
    skin("ww_redwood", "Redwood", "sniper", "restricted", p("bark", ["#4a1c0f", "#8c3b1e", "#c0582c"], 5, 123)),
    skin("ww_glade", "Emerald Glade", "smg", "classified", p("moss", ["#003d2e", "#00a86b", "#7fffd4"], 6, 131)),
    skin("ww_canopy", "Canopy", "shotgun", "classified", p("leaves", ["#081c15", "#2d6a4f", "#b7e4c7", "#fefae0"], 7, 132)),
    skin("ww_spirit", "Forest Spirit", "rifle", "covert", p("moss", ["#03045e", "#00b4d8", "#90e0ef", "#caf0f8"], 6, 141)),
    skin("ww_elder", "Elder Oak", "sniper", "covert", p("bark", ["#1a0f00", "#7f5539", "#ddb892", "#ffe8a3"], 6, 142)),
    skin("ww_knife", "Heartwood", "knife", "gold", p("leaves", ["#3d2b00", "#b8860b", "#ffd700", "#fff8dc"], 8, 151), KNIFE_MOTION),
  ],
};

const bedrock: CaseDef = {
  id: "bedrock",
  name: "Bedrock Case",
  theme: "rocks",
  tier: 3,
  color: "#5a5a66",
  skins: [
    skin("br_granite", "Granite", "rifle", "milspec", p("granite", ["#3c3c3c", "#6b6b6b", "#a9a9a9", "#d4d4d4"], 6, 211)),
    skin("br_slate", "Slate", "pistol", "milspec", p("marble", ["#2f3640", "#57606f", "#a4b0be"], 3, 212)),
    skin("br_sandstone", "Sandstone", "smg", "milspec", p("granite", ["#a0522d", "#cd853f", "#deb887"], 5, 213)),
    skin("br_basalt", "Basalt", "shotgun", "milspec", p("crystal", ["#121212", "#2b2b2b", "#444444"], 5, 214)),
    skin("br_quarry", "Quarry", "mg", "milspec", p("granite", ["#5c5346", "#8e8572", "#c2b8a3"], 4, 215)),
    skin("br_marble", "Carrara", "rifle", "restricted", p("marble", ["#e8e8e8", "#ffffff", "#7a7a7a"], 3, 221)),
    skin("br_amethyst", "Amethyst", "heavyPistol", "restricted", p("crystal", ["#2e1065", "#6d28d9", "#c4b5fd"], 6, 222)),
    skin("br_jade", "Jade", "sniper", "restricted", p("marble", ["#064e3b", "#10b981", "#d1fae5"], 4, 223)),
    skin("br_obsidian", "Obsidian Edge", "smg", "classified", p("crystal", ["#030303", "#1f1f2e", "#7c3aed"], 7, 231)),
    skin("br_sapphire", "Sapphire Vein", "shotgun", "classified", p("marble", ["#020617", "#1d4ed8", "#93c5fd"], 5, 232)),
    skin("br_magma", "Magma Core", "rifle", "covert", p("lava", ["#120400", "#3a0f00", "#ff4500", "#ffd000"], 5, 241)),
    skin("br_diamond", "Diamond Hands", "sniper", "covert", p("crystal", ["#0f172a", "#38bdf8", "#e0f2fe", "#ffffff"], 8, 242)),
    skin("br_knife", "Molten Crown", "knife", "gold", p("lava", ["#1a0a00", "#7a3b00", "#ffb000", "#fff3b0"], 6, 251), KNIFE_MOTION),
  ],
};

export const CASES: readonly CaseDef[] = [bootcamp, wildwood, bedrock];

const SKINS = new Map(CASES.flatMap((c) => c.skins.map((s) => [s.id, s] as const)));

export function caseById(id: string): CaseDef {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown case: ${id}`);
  return c;
}

export function skinById(id: string): SkinDef {
  const s = SKINS.get(id);
  if (!s) throw new Error(`unknown skin: ${id}`);
  return s;
}

function economy(caseId: string): { price: number; unlockCost: number } {
  const e = CASE_ECONOMY[caseId];
  if (!e) throw new Error(`no economy for case: ${caseId}`);
  return e;
}

export const priceOf = (caseId: string): number => economy(caseId).price;
export const unlockCostOf = (caseId: string): number => economy(caseId).unlockCost;

export const skinDisplayName = (s: SkinDef): string => `${WEAPON_NAMES[s.weapon]} | ${s.name}`;
