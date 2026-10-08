import type { GameView } from "../game/view";

// The day job's button (campaign spec §6.1): shown when broke with an empty bench and while the shift
// runs, so a broke player is never stuck.

export function dayJobButton(view: GameView): { enabled: boolean; progress: number } | null {
  const j = view.dayJob;
  if (!j.available && !j.working) return null;
  return { enabled: j.available, progress: j.progress };
}
