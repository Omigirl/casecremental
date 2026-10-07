import type { ComponentType, ReactNode } from "react";
import { outlined, v } from "@idosgames/react/ui";
import type { GameController } from "../game/controller";
import { formatCash } from "../sim/format";
import { useGameView } from "./useGameView";

export function makeGamePanel(controller: GameController): ComponentType {
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: v.font, color: v.text }}>
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", ...outlined, fontSize: 30, color: v.gold }}>
          {formatCash(view.cash)}
        </div>
      </div>
    );
  };
}
