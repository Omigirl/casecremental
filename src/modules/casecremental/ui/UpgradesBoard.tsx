import { useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { GameView, UpgradeView } from "../game/view";
import { caseName, rarityName, upgradeDesc, upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor, formatSpeed, nextBotCase, nextThreshold } from "./botBoard";
import { PxButton } from "./parts";

// The Upgrades board (left panel, or a drawer tab on phones). Tabs You / Bot / Machines: the bot opens
// its own cases (rework spec §1); the Machines tab holds the auto-seller.

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
  const open = view.finale === null && !view.over;
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
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!b.canBuySpeed} onClick={() => act({ type: "buyBotSpeed" })}>
            {formatCash(b.speedCost, lang)}
          </PxButton>
        )}
      </div>
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

function SellerPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  const s = view.seller;
  const lang = getLang();
  const open = view.finale === null && !view.over;
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
        <PxButton disabled={!open} onClick={() => act({ type: "setSellerThreshold", rarity: nextThreshold(s.threshold) })}>
          {t("btn.change")}
        </PxButton>
      </div>
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
          <PxButton key={id} on={tab === id} onClick={() => setTab(id)}>
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
          <SellerPanel view={view} act={act} />
        )}
      </div>
    </>
  );
}
