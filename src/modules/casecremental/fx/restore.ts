import type { BenchReel, RunState } from "../sim/run";
import type { Drop } from "../sim/types";

// What a freshly mounted World must redraw to match the run: the host destroys a suspended scene,
// so coming back from the lobby builds a new World over a run that is already in progress.

export interface RestorePlan {
  /** The case on the bench (locked, spinning or just opened). */
  caseId: string | null;
  /** The spin in progress — one reel per case, each landing on its own drop with its own tease (the World reads
   *  the elapsed time from the run every frame). */
  spinning: BenchReel[] | null;
  /** The cards waiting to be sold, left to right; null where one is already gone. */
  revealed: (Drop | null)[] | null;
  stage: number;
}

export function restorePlan(s: RunState): RestorePlan {
  const b = s.bench;
  return {
    caseId: b.phase === "empty" ? null : b.caseId,
    spinning: b.phase === "spinning" ? b.reels : null,
    revealed: b.phase === "revealed" ? b.cards : null,
    stage: s.stage,
  };
}
