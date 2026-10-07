import { useSyncExternalStore } from "react";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/view";

export function useGameView(controller: GameController): GameView {
  return useSyncExternalStore(controller.subscribe, controller.getView);
}
