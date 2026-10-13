import { VAULTS } from "../sim/content/vaults";
import { PERK_IDS, type MetaState } from "../sim/meta";
import type { ServerDoc } from "./bridge";

// A server answer merged into the local meta (plan F7). The server is the authority for CLOUT and perks — but only
// once nothing the player did offline is still waiting to reach it, and only when it has seen as many vaults as the
// local meta (else its answer is older than the local truth: writes still queued, a save from before F7, or calls the
// queue gave up on). The larger perk level is kept then.
// Loops and campaign stats only grow. A vault legend in the inventory is that vault's trophy. The best drop stays
// local (the server keeps only its skin and value).

/** The campaign stats F6-A adds to the meta (MetaState.stats), as far as the server keeps them. */
export interface CampaignStatsLike {
  playSeconds: number;
  opened: number;
  cloutEarned: number;
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** The meta's campaign stats, or null while the meta has none (before F6-A). Read by shape, so it needs no change
 *  when MetaState gains the field. */
export function campaignStatsOf(m: MetaState): CampaignStatsLike | null {
  const s = (m as unknown as { stats?: unknown }).stats;
  if (typeof s !== "object" || s === null) return null;
  const o = s as Record<string, unknown>;
  return isNum(o.playSeconds) && isNum(o.opened) && isNum(o.cloutEarned) ? (o as unknown as CampaignStatsLike) : null;
}

export function applyServerDoc(m: MetaState, doc: ServerDoc, pendingWrites: boolean): void {
  const authority = !pendingWrites && doc.loops >= m.loops;
  if (authority) m.clout = doc.clout;
  for (const id of PERK_IDS) {
    const server = doc.perks[id];
    if (server === undefined) continue;
    m.perks[id] = authority ? server : Math.max(m.perks[id], server);
  }
  m.loops = Math.max(m.loops, doc.loops);
  for (const v of VAULTS) if (doc.trophies.includes(v.legend.id) && !m.trophies.includes(v.trophy)) m.trophies.push(v.trophy);
  const stats = campaignStatsOf(m);
  if (stats) {
    stats.playSeconds = Math.max(stats.playSeconds, doc.stats.playSeconds);
    stats.opened = Math.max(stats.opened, doc.stats.opened);
    stats.cloutEarned = Math.max(stats.cloutEarned, doc.stats.cloutEarned);
  }
}
