import { useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { GameView, UpgradeView } from "../game/view";
import { rarityName, upgradeDesc, upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor, formatSpeed, nextThreshold } from "./botBoard";
import { PxButton } from "./parts";

// The Upgrades board (left panel, or a drawer tab on phones). Tabs You / Bot / Machines. The bot's tab
// wakes it and tunes it (M2b); the machines arrive in later runs, so their tab shows LOCKED.

type Act = (a: Action) => void;
type Tab = "you" | "bot" | "machines";

function UpgradeRow({ u, act }: { u: UpgradeView; act: Act }): ReactNode {
  return (
    <div className="cc-row">
      <div>{upgradeName(u.id)}</div>
      <div className="cc-dim">{t("label.level", { n: u.level })}</div>
      <div className="cc-dim">{upgradeDesc(u.id)}</div>
      {u.cost === null ? (
        <PxButton disabled>{t("btn.max")}</PxButton>
      ) : (
        <PxButton disabled={!u.canBuy} onClick={() => act({ type: "buyUpgrade", id: u.id })}>
          {formatCash(u.cost, getLang())}
        </PxButton>
      )}
    </div>
  );
}

function BotPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  const b = view.bot;
  const lang = getLang();
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
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!b.canBuySpeed} onClick={() => act({ type: "buyBotSpeed" })}>
            {formatCash(b.speedCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("bot.sells")}</div>
        <div style={{ color: cssColor(RARITY_INFO[b.threshold].color) }}>{rarityName(b.threshold)}</div>
        <PxButton onClick={() => act({ type: "setBotThreshold", rarity: nextThreshold(b.threshold) })}>{t("btn.change")}</PxButton>
      </div>
      {b.waiting ? <div style={{ color: "#ffd34d" }}>{t("bot.waiting")}</div> : null}
    </>
  );
}

export function UpgradesBoard({ view, act, title = true }: { view: GameView; act: Act; title?: boolean }): ReactNode {
  const [tab, setTab] = useState<Tab>("you");
  const tabs: Array<[Tab, string]> = [
    ["you", t("tab.you")],
    ["bot", t("tab.bot")],
    ["machines", t("tab.machines")],
  ];
  return (
    <>
      {title ? <div className="cc-title">{t("panel.upgrades")}</div> : null}
      <div className="cc-tabs">
        {tabs.map(([id, label]) => (
          <PxButton
            key={id}
            on={tab === id}
            disabled={id === "machines"}
            title={id === "machines" ? t("tab.locked") : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </PxButton>
        ))}
      </div>
      <div className="cc-scroll">
        {tab === "you" ? (
          view.upgrades.map((u) => <UpgradeRow key={u.id} u={u} act={act} />)
        ) : tab === "bot" ? (
          <BotPanel view={view} act={act} />
        ) : (
          <div className="cc-dim">{t("tab.locked")}</div>
        )}
      </div>
    </>
  );
}
