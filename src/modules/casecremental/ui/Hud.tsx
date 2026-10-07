import type { ReactNode } from "react";
import { outlined, v } from "@idosgames/react/ui";
import type { GameView } from "../game/view";
import { formatCash } from "../sim/format";
import { HUD_HEIGHT } from "../fx/layout";

// Top of the screen: cash, the intensity stage, the combo and the next goal — always visible
// (spec §9.2: a goal is always on screen).

export function Hud({ view }: { view: GameView }): ReactNode {
  return (
    <div style={{ position: "absolute", top: 6, left: 0, right: 0, height: HUD_HEIGHT - 6, display: "grid", justifyItems: "center", alignContent: "start", gap: 4 }}>
      <div style={{ ...outlined, fontSize: 30, lineHeight: 1.1, color: v.gold }}>{formatCash(view.cash)}</div>
      <div style={{ display: "flex", gap: 12, ...outlined, fontSize: 13 }}>
        <span style={{ color: view.stage >= 2 ? "#ff7ad9" : v.textDim }}>{view.stageName}</span>
        {view.combo > 1 ? <span style={{ color: "#7affc1" }}>COMBO ×{view.comboMult.toFixed(2)}</span> : null}
      </div>
      {view.nextGoal ? (
        <div style={{ width: "min(320px, 80vw)", display: "grid", gap: 2 }}>
          <div style={{ ...outlined, fontSize: 11, color: v.textDim, textAlign: "center" }}>{view.nextGoal.label}</div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(view.nextGoal.progress * 100)}%`, height: "100%", background: view.nextGoal.progress >= 1 ? "#3ddc84" : v.gold, transition: "width .2s" }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
