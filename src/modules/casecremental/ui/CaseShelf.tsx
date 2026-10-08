import { useContext, type ReactNode } from "react";
import { spriteIndex } from "../fx/pixel/sprites";
import type { Action } from "../game/controller";
import type { CaseView, GameView } from "../game/view";
import { caseName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { PxButton, UiEnvContext } from "./parts";
import { stripFrameCss } from "./pixelFrame";

// The Case shelf (right panel, or a drawer tab on phones): each case with its pixel box, BUY at
// its price or UNLOCK at its unlock cost. Every button sends an Action through the controller.

type Act = (a: Action) => void;

function CaseIcon({ c }: { c: CaseView }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const k = Math.max(1, Math.floor(scale / 2));
  const css = stripFrameCss(spriteIndex().get(`case-${c.id}`), 0, k);
  const style = css ?? { width: 13 * k, height: 10 * k, background: c.color, boxShadow: `0 0 0 ${k}px #120e10` };
  return <div style={{ ...style, flex: "none", opacity: c.unlocked ? 1 : 0.4 }} />;
}

function CaseRow({ c, act }: { c: CaseView; act: Act }): ReactNode {
  return (
    <div className="cc-row">
      <div className="cc-row-line">
        <CaseIcon c={c} />
        <span style={{ flex: 1 }}>{caseName(c.id)}</span>
      </div>
      {c.unlocked ? (
        <PxButton disabled={!c.canBuy} onClick={() => act({ type: "buyCase", caseId: c.id })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(c.price, getLang())}</span>
        </PxButton>
      ) : (
        <PxButton disabled={!c.canUnlock} onClick={() => act({ type: "unlockCase", caseId: c.id })}>
          {t("btn.unlock")}
          <span className="cc-btn-sub">{formatCash(c.unlockCost, getLang())}</span>
        </PxButton>
      )}
    </div>
  );
}

export function CaseShelf({ view, act, title = true }: { view: GameView; act: Act; title?: boolean }): ReactNode {
  return (
    <>
      {title ? <div className="cc-title">{t("panel.cases")}</div> : null}
      <div className="cc-scroll">
        {view.cases.map((c) => (
          <CaseRow key={c.id} c={c} act={act} />
        ))}
      </div>
    </>
  );
}
