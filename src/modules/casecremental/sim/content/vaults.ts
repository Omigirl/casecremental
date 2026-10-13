import type { SkinDef } from "../types";
import { p, skin } from "./skinHelpers";

// One vault per run (rework spec §4); Run 4's is The Last Case (finish spec §7.4). Bought once the run's cases are
// unlocked, opened with the devil key.
// Its four ordinary rewards come from `sourceCase`; the fifth is the animated legend knife.

export interface VaultDef {
  /** Also the vault's case id on its drops, and its name key (`vault1`…, `lastcase`). */
  id: "vault1" | "vault2" | "vault3" | "lastcase";
  run: number;
  /** The trophy kept forever. */
  trophy: string;
  /** Its four ordinary rewards come from this case. */
  sourceCase: string;
  /** The fifth reward. */
  legend: SkinDef;
}

const flipFlow = { pattern: "flow", weapon: "flip", frames: 16, fps: 8 } as const;

export const VAULTS: readonly VaultDef[] = [
  {
    id: "vault1",
    run: 1,
    trophy: "vault1",
    sourceCase: "bedrock",
    // an animated texture — a flowing aurora — plus the knife's turn
    legend: skin(
      "vault1_legend",
      "Event Horizon",
      "knife",
      "gold",
      p("lava", ["#12002a", "#5b2bd6", "#ff3fb4", "#ffd34d", "#fffbe0"], 7, 401),
      flipFlow,
    ),
  },
  {
    id: "vault2",
    run: 2,
    trophy: "vault2",
    sourceCase: "neon",
    legend: skin(
      "vault2_legend",
      "Overdrive",
      "knife",
      "gold",
      p("hueflow", ["#ff006e", "#fb5607", "#ffbe0b", "#3a86ff", "#8338ec"], 5, 402),
      flipFlow,
    ),
  },
  {
    id: "vault3",
    run: 3,
    trophy: "vault3",
    sourceCase: "inferno",
    legend: skin(
      "vault3_legend",
      "Supernova",
      "knife",
      "gold",
      p("nebula", ["#000000", "#3a0060", "#ff4500", "#ffd700", "#ffffff"], 5, 403),
      flipFlow,
    ),
  },
  {
    id: "lastcase",
    run: 4,
    trophy: "lastcase",
    sourceCase: "feverdream",
    // black glass and gold (finish spec §7.4): the legend's hues turn through white, gold and the void
    legend: skin(
      "lastcase_legend",
      "Singularity",
      "knife",
      "gold",
      p("huecycle", ["#000000", "#1a1a1a", "#ffd700", "#fff6d5", "#ffffff"], 5, 404),
      flipFlow,
    ),
  },
];

/** The vault of a run; runs past the last clamp to it, like runContent. */
export const vaultFor = (run: number): VaultDef => VAULTS[Math.min(Math.max(run, 1), VAULTS.length) - 1]!;

export const VAULT_LEGEND: SkinDef = VAULTS[0]!.legend;
