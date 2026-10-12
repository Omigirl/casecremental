import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { boardOpen, nextReserve, percent, type Act } from "./machineRules";
import { PxButton } from "./parts";

// The auto-buyer's rows on the Machines tab (spec §6, Run 3+; hidden before): buy it (only once the auto-seller is
// on — its drops need an output), its Rate and Size, and the share of your cash it never spends.

export function GridRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const g = view.grid;
  const lang = getLang();
  if (!g.available) return null;
  if (!g.on)
    return (
      <div className="cc-row">
        <div>{t("grid.name")}</div>
        <div className="cc-dim">{g.needsSeller ? t("grid.needs") : t("grid.desc")}</div>
        <PxButton disabled={!g.canBuy} onClick={() => act({ type: "buyGrid" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(g.cost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("grid.name")}</div>
        <div className="cc-dim">{t("grid.rate", { n: g.rateLevel })}</div>
        {g.rateCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!g.canBuyRate} onClick={() => act({ type: "buyGridRate" })}>
            {formatCash(g.rateCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div className="cc-dim">{t("grid.size", { n: g.size })}</div>
        {g.sizeCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!g.canBuySize} onClick={() => act({ type: "buyGridSize" })}>
            {formatCash(g.sizeCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("grid.reserve", { n: percent(g.reserve) })}</div>
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setGridReserve", reserve: nextReserve(g.reserve) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}
