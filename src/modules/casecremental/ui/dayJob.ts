import type { GameView } from "../game/view";

// The day job's button while Plan M2b-B has not drawn the real one: shown when broke with an empty bench
// (campaign spec §6.1) and while the shift runs, so a broke player is never stuck.

export function dayJobButton(view: GameView): { enabled: boolean; progress: number } | null {
  const j = view.dayJob;
  if (!j.available && !j.working) return null;
  return { enabled: j.available, progress: j.progress };
}
