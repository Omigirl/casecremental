import { useContext, useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { GameView } from "../game/view";
import { t } from "../i18n/index";
import { CaseShelf } from "./CaseShelf";
import { PxButton, UiEnvContext } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { UpgradesBoard } from "./UpgradesBoard";

// Phones (portrait): the pixel world fills the top 60 %; the Case shelf and the Upgrades board
// share a drawer below it as two tabs (spec §3.2).

type Act = (a: Action) => void;

export function Drawer({ view, act, top }: { view: GameView; act: Act; top: number }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const [tab, setTab] = useState<"cases" | "upgrades">("cases");
  return (
    <div
      className="cc-panel"
      style={{
        left: 0,
        right: 0,
        top,
        bottom: 0,
        padding: 2 * scale,
        paddingBottom: `calc(${2 * scale}px + var(--idos-safe-bottom, 0px))`,
        ...frameCss(uiSpriteUrl("ui-frame"), scale),
      }}
    >
      <div className="cc-tabs">
        <PxButton tut="drawer:cases" on={tab === "cases"} onClick={() => setTab("cases")}>
          {t("panel.cases")}
        </PxButton>
        <PxButton tut="drawer:upgrades" on={tab === "upgrades"} onClick={() => setTab("upgrades")}>
          {t("panel.upgrades")}
        </PxButton>
      </div>
      {tab === "cases" ? <CaseShelf view={view} act={act} title={false} /> : <UpgradesBoard view={view} act={act} title={false} />}
    </div>
  );
}
