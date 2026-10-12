import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { rarityName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor } from "./botBoard";
import { boardOpen, nextCollect, tradeUpProgress, type Act } from "./machineRules";
import { Bar, PxButton } from "./parts";

// The locker's rows on the Machines tab (spec §5, Run 2+; hidden before): buy it; its size; what the auto-seller
// collects into it; TRADE UP with its n/10 (a bar while the press runs); Run 3's auto contract.

export function LockerRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const k = view.locker;
  const lang = getLang();
  if (!k.available) return null;
  if (!k.on)
    return (
      <div className="cc-row">
        <div>{t("locker.name")}</div>
        <div className="cc-dim">{t("locker.desc")}</div>
        <PxButton disabled={!k.canBuy} onClick={() => act({ type: "buyLocker" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(k.cost, lang)}</span>
        </PxButton>
      </div>
    );
  const p = tradeUpProgress(k.counts, k.collect, k.tradeUp);
  return (
    <>
      <div className="cc-row">
        <div>{t("locker.name")}</div>
        <div className="cc-dim">{t("locker.count", { n: k.count, max: k.capacity })}</div>
        <div className="cc-dim">{t("locker.size", { n: k.sizeLevel })}</div>
        {k.sizeCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!k.canBuySize} onClick={() => act({ type: "buyLockerSize" })}>
            {formatCash(k.sizeCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("locker.collect")}</div>
        {k.collect ? (
          <div style={{ color: cssColor(RARITY_INFO[k.collect].color) }}>{rarityName(k.collect)}</div>
        ) : (
          <div className="cc-dim">{t("locker.off")}</div>
        )}
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setCollect", rarity: nextCollect(k.collect) })}>
          {t("btn.change")}
        </PxButton>
      </div>
      <div className="cc-row">
        {k.pressing ? (
          <>
            <div>{t("locker.pressing")}</div>
            <Bar progress={k.pressProgress} />
          </>
        ) : (
          <PxButton disabled={!k.canTradeUp} onClick={() => act({ type: "tradeUp" })}>
            {t("btn.tradeup")}
            <span className="cc-btn-sub" style={{ color: cssColor(RARITY_INFO[p.rarity].color) }}>{`${p.n}/${p.of}`}</span>
          </PxButton>
        )}
      </div>
      {k.autoAvailable ? (
        <div className="cc-row">
          <div>{t("locker.auto")}</div>
          <div className="cc-dim">{t("locker.autodesc")}</div>
          {k.auto ? (
            <PxButton disabled on>
              {t("locker.autoon")}
            </PxButton>
          ) : (
            <PxButton disabled={!k.canBuyAuto} onClick={() => act({ type: "buyAutoContract" })}>
              {t("btn.buy")}
              <span className="cc-btn-sub">{formatCash(k.autoCost, lang)}</span>
            </PxButton>
          )}
        </div>
      ) : null}
    </>
  );
}
