import type { RunState } from "../sim/run";
import type { Drop } from "../sim/types";

// What a freshly mounted World must redraw to match the run: the host destroys a suspended scene,
// so coming back from the lobby builds a new World over a run that is already in progress.

export interface RestorePlan {
  /** The case on the bench (locked, spinning or just opened). */
  caseId: string | null;
  /** The spin in progress — the reel must land on this drop. */
  spinning: Drop | null;
  /** The skin waiting to be sold. */
  revealed: Drop | null;
  stage: number;
}

export function restorePlan(s: RunState): RestorePlan {
  const b = s.bench;
  return {
    caseId: b.phase === "empty" ? null : b.caseId,
    spinning: b.phase === "spinning" ? b.drop : null,
    revealed: b.phase === "revealed" ? b.drop : null,
    stage: s.stage,
  };
}
