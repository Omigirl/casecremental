import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { rarityName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor, nextThreshold } from "./botBoard";
import { AutoSpinRows } from "./AutoSpinRows";
import { LockerRows } from "./LockerRows";
import { boardOpen, type Act } from "./machineRules";
import { PxButton } from "./parts";

// The Machines tab: the auto-seller and auto-spin (Run 1), the locker (Run 2+). A machine of a later
// run has no rows until its run (spec §2).

function SellerRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const s = view.seller;
  const lang = getLang();
  if (!s.on)
    return (
      <div className="cc-row">
        <div>{t("seller.name")}</div>
        <div className="cc-dim">{t("seller.desc")}</div>
        <PxButton disabled={!s.canBuy} onClick={() => act({ type: "buySeller" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(s.cost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("seller.name")}</div>
        <div className="cc-dim">{t("seller.speed", { n: s.speedLevel })}</div>
        {s.speedCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!s.canBuySpeed} onClick={() => act({ type: "buySellerSpeed" })}>
            {formatCash(s.speedCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("seller.sells")}</div>
        <div style={{ color: cssColor(RARITY_INFO[s.threshold].color) }}>{rarityName(s.threshold)}</div>
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setSellerThreshold", rarity: nextThreshold(s.threshold) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}

export function MachinesPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  return (
    <>
      <SellerRows view={view} act={act} />
      <AutoSpinRows view={view} act={act} />
      <LockerRows view={view} act={act} />
    </>
  );
}
