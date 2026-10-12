import type { ServerDoc, ServerMeta } from "../meta/bridge";
import type { JsonObject } from "../meta/queue";
import { trophyDropsOf } from "../meta/trophies";
import type { MetaState } from "../sim/meta";
import type { SimEvent } from "../sim/run";

// The game ↔ server seam (plan F7). Sim events become queued server calls — a new trophy, the vault (endRun and the
// meta), a perk, a charm pick — and every server answer is merged into the meta. Nothing here waits: calls go
// through the queue, which retries on its own clock. The local save is restored synchronously by the controller
// before this connects, so the game (and the tutorial's first look at it) never depends on the server.

export interface SyncTarget {
  readonly meta: MetaState;
  readonly run: {
    readonly seed: number;
    readonly setup: { readonly charms: readonly string[] };
    readonly state: { readonly time: number };
  };
  onEvent(l: (e: SimEvent) => void): () => void;
  applyServerMeta(doc: ServerDoc, pendingWrites: boolean): void;
}

/** One id per run: run seeds differ between runs (the controller derives each from the last). */
export const runIdOf = (seed: number): string => `r${(seed >>> 0).toString(36)}`;

/** The campaign stats (F6-A's MetaState.stats), read by shape so this needs no change when the field lands. */
function statsOf(m: MetaState): { playSeconds: number; opened: number; best: { skinId: string; value: number } | null } | null {
  const s = (m as unknown as { stats?: Record<string, unknown> }).stats;
  if (typeof s !== "object" || s === null || typeof s.playSeconds !== "number" || typeof s.opened !== "number") return null;
  const b = s.best as { skinId?: unknown; value?: unknown } | null | undefined;
  const best = b && typeof b.skinId === "string" && typeof b.value === "number" ? { skinId: b.skinId, value: b.value } : null;
  return { playSeconds: Math.floor(s.playSeconds), opened: s.opened, best };
}

/** saveMeta's arguments: the charms — being picked on the prestige screen, else the run's own (so a new device can
 *  rebuild the run with them) — and the campaign stats once the meta keeps them. */
export function metaArgs(m: MetaState, runCharms: readonly string[]): JsonObject {
  const picked = m.offer ? [...m.picked] : [...runCharms];
  const stats = statsOf(m);
  return stats ? { picked, stats } : { picked };
}

export function connectServer(target: SyncTarget, server: ServerMeta, pumpEverySec = 5): () => void {
  const asked = new Set<string>();
  let saves = 0;
  const offEvent = target.onEvent((e) => {
    const run = target.run;
    const runId = runIdOf(run.seed);
    for (const d of trophyDropsOf(e)) {
      if (asked.has(d.skinId) || server.trophies.has(d.skinId)) continue;
      asked.add(d.skinId);
      server.enqueue("reportTrophy", { skinId: d.skinId, runId, elapsedSec: Math.floor(run.state.time) }, `trophy-${d.skinId}`);
    }
    if (e.type === "vaultOpened") {
      server.enqueue(
        "endRun",
        {
          runId,
          lifetimeEarnings: e.lifetimeEarnings,
          elapsedSec: Math.floor(run.state.time),
          endedAt: Math.floor(Date.now() / 1000),
          finaleReached: true,
          trophy: e.trophy,
        },
        `end-${runId}`,
      );
      server.enqueue("saveMeta", metaArgs(target.meta, target.run.setup.charms), `meta-${runId}`);
    }
    if (e.type === "perkBought") server.enqueue("buyPerk", { perkId: e.id, level: e.level - 1 }, `perk-${e.id}-${e.level}`);
    if (e.type === "charmPicked" || e.type === "runStarted")
      server.enqueue("saveMeta", metaArgs(target.meta, target.run.setup.charms), `meta-${Date.now()}-${++saves}`);
  });
  const offDoc = server.onDoc((doc) => target.applyServerMeta(doc, server.hasPendingWrites()));
  // the server answered: what waits from an earlier session goes now, not at its back-off time
  void server.load().then((doc) => (doc ? server.retryNow() : server.pump()));
  const timer = pumpEverySec > 0 ? setInterval(() => void server.pump(), pumpEverySec * 1000) : null;
  return () => {
    offEvent();
    offDoc();
    if (timer) clearInterval(timer);
  };
}
