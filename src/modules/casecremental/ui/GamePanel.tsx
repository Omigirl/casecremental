import type { ComponentType, ReactNode } from "react";
import { v } from "@idosgames/react/ui";
import type { GameController } from "../game/controller";
import { Hud } from "./Hud";
import { comboTint } from "./juice";
import { Shop } from "./Shop";
import { useGameView } from "./useGameView";

// The overlay over the canvas. The layer itself lets pointer events through to the canvas (drag
// the key, brake, drag the skin); only the HUD's and the shop's controls take them.

export function makeGamePanel(controller: GameController): ComponentType {
  const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    const tint = comboTint(view.combo);
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: v.font, color: v.text }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `hsla(${tint.hue}, 100%, 55%, ${tint.alpha})`,
            mixBlendMode: "screen",
            transition: "background .4s",
          }}
        />
        <Hud view={view} />
        <Shop view={view} act={act} />
      </div>
    );
  };
}
