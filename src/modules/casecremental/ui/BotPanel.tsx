import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { caseName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { formatSpeed, nextBotCase } from "./botBoard";
import { boardOpen, capKey, type Act } from "./machineRules";
import { PxButton } from "./parts";

// The Bot tab (rework spec §1, M3 spec §4): wake it, its Speed (NEXT RUN at this run's cap), its multi-open ×2
// (Run 2+), and the case it opens.

export function BotPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  const b = view.bot;
  const lang = getLang();
  const open = boardOpen(view);
  const unlocked = view.cases.filter((c) => c.unlocked).map((c) => c.id);
  if (!b.awake)
    return (
      <div className="cc-row">
        <div>{t("bot.asleep")}</div>
        <div className="cc-dim">{t("bot.awake")}</div>
        <PxButton disabled={!b.canWake} onClick={() => act({ type: "wakeBot" })}>
          {t("btn.wake")}
          <span className="cc-btn-sub">{formatCash(b.wakeCost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("bot.speed", { n: formatSpeed(b.speed, lang) })}</div>
        <div className="cc-dim">{t("label.level", { n: b.speedLevel })}</div>
        {b.speedCost === null ? (
          <PxButton disabled>{t(capKey(b.speedNextRun))}</PxButton>
        ) : (
          <PxButton disabled={!b.canBuySpeed} onClick={() => act({ type: "buyBotSpeed" })}>
            {formatCash(b.speedCost, lang)}
          </PxButton>
        )}
      </div>
      {b.multiAvailable ? (
        <div className="cc-row">
          <div>{t("bot.multi")}</div>
          <div className="cc-dim">{t("bot.multidesc")}</div>
          {b.multiLevel > 0 ? (
            <PxButton disabled>{t("btn.max")}</PxButton>
          ) : (
            <PxButton disabled={!b.canBuyMulti} onClick={() => act({ type: "buyBotMulti" })}>
              {t("btn.buy")}
              <span className="cc-btn-sub">{formatCash(b.multiCost, lang)}</span>
            </PxButton>
          )}
        </div>
      ) : null}
      <div className="cc-row">
        <div>{t("bot.opens")}</div>
        <div className="cc-dim">{b.caseChoice === null ? t("bot.best") : caseName(b.caseChoice)}</div>
        <PxButton disabled={!open} onClick={() => act({ type: "setBotCase", caseId: nextBotCase(b.caseChoice, unlocked) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}
