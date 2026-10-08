import { RUN1_CHARMS, type CharmId } from "./charms";
import { createRng } from "./rng";
import type { ActionResult, RunSetup } from "./run";
import {
  CATCH_UP_PER_VAULT,
  CHARM_OFFER_SIZE,
  CLOUT_DIVISOR,
  PERK_COSTS,
  PERK_START_CASH,
  START_CASH,
  TRAY_BASE_CAPACITY,
  TRAY_PER_PERK,
  VAULT_BASE_PRICE,
  VAULT_GROWTH,
} from "./tuning";

// What outlives a run (M2b spec §8): CLOUT, the perks bought with it, trophies, how many vaults have been
// opened, and the charms offered and picked for the next run. Plain data plus the rules; the controller
// owns one and saves it.

export type PerkId = keyof typeof PERK_COSTS;
export const PERK_IDS: readonly PerkId[] = ["startCash", "luck", "charmSlot", "botAwake", "biggerTray"];

export interface MetaState {
  clout: number;
  perks: Record<PerkId, number>;
  trophies: string[];
  /** Vaults opened — completed runs. */
  loops: number;
  /** CLOUT the last vault paid (for the prestige screen). */
  lastGain: number;
  /** Charms offered for the next run; null when not on the prestige screen. */
  offer: CharmId[] | null;
  picked: CharmId[];
}

export const freshMeta = (): MetaState => ({
  clout: 0,
  perks: { startCash: 0, luck: 0, charmSlot: 0, botAwake: 0, biggerTray: 0 },
  trophies: [],
  loops: 0,
  lastGain: 0,
  offer: null,
  picked: [],
});

const OK: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export const cloutFor = (lifetimeEarnings: number): number => Math.floor(Math.sqrt(Math.max(0, lifetimeEarnings)) / CLOUT_DIVISOR);

export function perkCost(id: PerkId, level: number): number | null {
  const c = PERK_COSTS[id];
  if (level >= c.maxLevel) return null;
  return Math.ceil(c.baseCost * c.growth ** level);
}

export const charmSlots = (m: MetaState): number => 1 + m.perks.charmSlot;

/** Three distinct charms from the run's pool — the same for the same seed and loop. */
export function offerCharms(seed: number, loops: number): CharmId[] {
  const rng = createRng((seed ^ Math.imul(loops + 1, 0x9e3779b1)) >>> 0);
  const pool = [...RUN1_CHARMS];
  const out: CharmId[] = [];
  while (out.length < CHARM_OFFER_SIZE && pool.length > 0) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  return out;
}

/** A vault opened: pay CLOUT, keep the trophy, count the loop, offer the next run's charms. */
export function completeVault(m: MetaState, lifetimeEarnings: number, trophy: string, seed: number): void {
  const gain = cloutFor(lifetimeEarnings);
  m.clout += gain;
  m.lastGain = gain;
  m.loops += 1;
  if (!m.trophies.includes(trophy)) m.trophies.push(trophy);
  m.offer = offerCharms(seed, m.loops);
  m.picked = [];
}

export function buyPerk(m: MetaState, id: PerkId): ActionResult {
  const cost = perkCost(id, m.perks[id]);
  if (cost === null) return fail("max level");
  if (m.clout < cost) return fail("not enough CLOUT");
  m.clout -= cost;
  m.perks[id] += 1;
  return OK;
}

/** Toggle a charm for the next run (at most charmSlots). */
export function pickCharm(m: MetaState, id: CharmId): ActionResult {
  if (!m.offer) return fail("no charms on offer");
  if (!m.offer.includes(id)) return fail("not offered");
  const i = m.picked.indexOf(id);
  if (i >= 0) {
    m.picked.splice(i, 1);
    return OK;
  }
  if (m.picked.length >= charmSlots(m)) return fail("no free charm slot");
  m.picked.push(id);
  return OK;
}

export function setupFor(m: MetaState): RunSetup {
  return {
    startCash: START_CASH + PERK_START_CASH * m.perks.startCash,
    luckBonus: m.perks.luck,
    charms: [...m.picked],
    botAwake: m.perks.botAwake > 0,
    trayCapacity: TRAY_BASE_CAPACITY + TRAY_PER_PERK * m.perks.biggerTray,
    valueBoost: CATCH_UP_PER_VAULT ** m.loops,
    vaultPrice: VAULT_BASE_PRICE * VAULT_GROWTH ** m.loops,
  };
}
