import { CASE_ECONOMY } from "../tuning";
import type { CaseDef, SkinDef } from "../types";
import { RUN1_CASES } from "./casesRun1";
import { RUN2_CASES } from "./casesRun2";
import { RUN3_CASES } from "./casesRun3";
import { RUN4_CASES } from "./casesRun4";
import { VAULTS } from "./vaults";
import { WEAPON_NAMES } from "./weapons";

// The case ladder. Each later case uses a richer pattern technique than the one before it, so its
// cheapest skins already outshine the previous case's best (spec §4.3, §5). Cases per run: casesRun1/2/3/4.

export { VAULT_LEGEND } from "./vaults";

export const CASES: readonly CaseDef[] = [...RUN1_CASES, ...RUN2_CASES, ...RUN3_CASES, ...RUN4_CASES];

const SKINS = new Map<string, SkinDef>([...CASES.flatMap((c) => c.skins), ...VAULTS.map((v) => v.legend)].map((s) => [s.id, s]));

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
