import { useContext, useEffect, useRef, type ReactNode } from "react";
import { useAnimatedNumber } from "@idosgames/react/ui";
import { springElement } from "../fx/hd/tween";
import type { GameView } from "../game/view";
import { caseName, stageName, upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { fromCents, toCents } from "./cash";
import { Bar, PixelGear, PxButton, UiEnvContext } from "./parts";

// Top of the screen: the stage, the cash (large, gold), the combo, the next goal (always visible —
// spec §9.2) and the settings button. Height = the layout's HUD band.

function goalName(goal: NonNullable<GameView["nextGoal"]>): string {
  if (goal.kind === "vault") return caseName("vault1");
  return goal.kind === "unlock" ? caseName(goal.caseId) : `${upgradeName(goal.upgradeId)} ${t("label.level", { n: goal.level })}`;
}

export function Hud({ view, hudH, onSettings }: { view: GameView; hudH: number; onSettings: () => void }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const shown = fromCents(useAnimatedNumber(toCents(view.cash), 350));
  const cashRef = useRef<HTMLDivElement>(null);
  const previous = useRef(view.cash);
  useEffect(() => {
    if (view.cash > previous.current && cashRef.current) springElement(cashRef.current, 0.08);
    previous.current = view.cash;
  }, [view.cash]);
  const lang = getLang();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: hudH * scale,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "start",
        padding: `${scale}px ${3 * scale}px`,
        pointerEvents: "none",
      }}
    >
      <div />
      <div style={{ display: "grid", justifyItems: "center", gap: scale }}>
        <div ref={cashRef} className="cc-gold" style={{ fontSize: "calc(var(--fs) * 2)", lineHeight: 1 }}>
          {formatCash(shown, lang)}
        </div>
        {view.nextGoal ? (
          <div style={{ display: "flex", alignItems: "center", gap: 2 * scale, width: "max-content" }}>
            <div className="cc-dim">{t("hud.next", { name: goalName(view.nextGoal) })}</div>
            <div style={{ width: 24 * scale }}>
              <Bar progress={view.nextGoal.progress} />
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "start", gap: 2 * scale }}>
        <span style={{ color: view.stage >= 2 ? "#ff7ad9" : "#a89a8c" }}>{stageName(view.stage)}</span>
        {view.combo > 1 ? (
          <span style={{ color: "#7affc1" }}>
            {t("hud.combo", { mult: view.comboMult.toFixed(2).replace(".", lang === "ru" ? "," : ".") })}
          </span>
        ) : null}
        <span style={{ pointerEvents: "auto" }}>
          <PxButton onClick={onSettings} title={t("hud.settings")} style={{ lineHeight: 1 }}>
            <PixelGear />
          </PxButton>
        </span>
      </div>
    </div>
  );
}
