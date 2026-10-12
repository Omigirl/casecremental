import { BLACKOUT_SECONDS } from "../fx/vault/lights";
import type { PrestigeView } from "../game/view";
import type { CharmId } from "../sim/charms";
import type { VaultDef } from "../sim/content/vaults";
import { caseName } from "../i18n/content";
import { t } from "../i18n/index";
import { botSpeed } from "../sim/botOpener";
import { runCaseIds, runContent } from "../sim/campaign";

const NUMERALS = { vault1: "I", vault2: "II", vault3: "III" } as const;

/** The vault's number on the prestige screen ("VAULT II OPENED", "★ Vault II trophy"). */
export const vaultNumeral = (id: VaultDef["id"]): (typeof NUMERALS)[VaultDef["id"]] => NUMERALS[id];

// The prestige screen's rules (M2b spec §8): pick up to `slots` of the three offered charms; the screen
// waits for the blackout when you watched the run end, and comes up at once after a reload.

export function charmChoices(p: PrestigeView): Array<{ id: CharmId; picked: boolean; enabled: boolean }> {
  return p.offer.map((id) => {
    const picked = p.picked.includes(id);
    return { id, picked, enabled: picked || p.picked.length < p.slots };
  });
}

/** The blackout plus a beat. */
export const PRESTIGE_DELAY_MS = Math.round(BLACKOUT_SECONDS * 1000) + 300;

export const prestigeDelayMs = (sawRunEnd: boolean): number => (sawRunEnd ? PRESTIGE_DELAY_MS : 0);

export type Bring =
  | { kind: "case"; caseId: string }
  | { kind: "machine"; id: "botMulti" | "locker" | "autoContract" }
  | { kind: "cap"; id: "multiOpen" | "botSpeed"; value: number };

/** What run `run` adds over the one before it (spec §8): its new cases, its new machines, its raised caps. */
export function runBrings(run: number): Bring[] {
  if (run <= 1) return [];
  const now = runContent(run);
  const before = runContent(run - 1);
  const out: Bring[] = runCaseIds(run)
    .slice(before.cases)
    .map((caseId) => ({ kind: "case", caseId }));
  if (now.botMultiOpen > before.botMultiOpen) out.push({ kind: "machine", id: "botMulti" });
  if (now.locker && !before.locker) out.push({ kind: "machine", id: "locker" });
  if (now.autoContract && !before.autoContract) out.push({ kind: "machine", id: "autoContract" });
  if (now.multiOpen > before.multiOpen) out.push({ kind: "cap", id: "multiOpen", value: now.multiOpen });
  if (now.botSpeedLevels > before.botSpeedLevels)
    out.push({ kind: "cap", id: "botSpeed", value: Math.round(botSpeed(now.botSpeedLevels)) });
  return out;
}

export function bringText(b: Bring): string {
  if (b.kind === "case") return t("brings.case", { name: caseName(b.caseId) });
  if (b.kind === "cap") return t(b.id === "multiOpen" ? "brings.multiOpen" : "brings.botSpeed", { n: b.value });
  return t(`brings.${b.id}` as const);
}
