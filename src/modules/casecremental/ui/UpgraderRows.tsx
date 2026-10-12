import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { rarityName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor } from "./botBoard";
import { boardOpen, type Act } from "./machineRules";
import { Bar, PxButton } from "./parts";
import { nextStake, nextTarget, percentText } from "./run4Rules";

// The Upgrader's rows on the Machines tab (finish spec §7.2, Run 4+; hidden before): buy it (after the locker);
// the stake (a locker rarity stack, CHANGE cycles what the locker holds); the target multiplier; GO with its win
// chance, or the dial's bar while it spins.

export function UpgraderRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const u = view.upgrader;
  const lang = getLang();
  if (!u.available) return null;
  if (!u.on)
    return (
      <div className="cc-row">
        <div>{t("upgrader.name")}</div>
        <div className="cc-dim">{u.needsLocker ? t("upgrader.needs") : t("upgrader.desc")}</div>
        <PxButton disabled={!u.canBuy} onClick={() => act({ type: "buyUpgrader" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(u.cost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("upgrader.stake")}</div>
        {u.stake ? (
          <div style={{ color: cssColor(RARITY_INFO[u.stake].color) }}>
            {rarityName(u.stake)} {t("upgrader.stakeOf", { n: u.stakeCount, v: formatCash(u.stakeValue, lang) })}
          </div>
        ) : (
          <div className="cc-dim">{u.stakes.length ? t("upgrader.none") : t("upgrader.empty")}</div>
        )}
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setUpgraderStake", rarity: nextStake(u.stakes, u.stake) })}>
          {t("btn.change")}
        </PxButton>
      </div>
      <div className="cc-row">
        <div>{t("upgrader.target")}</div>
        <div className="cc-gold">{`x${u.mult}`}</div>
        <PxButton disabled={!boardOpen(view) || u.spinning} onClick={() => act({ type: "setUpgraderTarget", index: nextTarget(u.target) })}>
          {t("btn.change")}
        </PxButton>
      </div>
      <div className="cc-row">
        {u.spinning ? (
          <>
            <div>{t("upgrader.rolling")}</div>
            <Bar progress={u.progress} />
          </>
        ) : (
          <PxButton disabled={!u.canGo} onClick={() => act({ type: "upgraderGo" })}>
            {t("btn.go")}
            <span className="cc-btn-sub">{t("upgrader.chance", { p: percentText(u.chance) })}</span>
          </PxButton>
        )}
      </div>
    </>
  );
}
