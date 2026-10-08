import { useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { GameView, UpgradeView } from "../game/view";
import { upgradeDesc, upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { PxButton } from "./parts";

// The Upgrades board (left panel, or a drawer tab on phones). Tabs You / Bot / Machines; the bot
// and the machines arrive in later runs, so their tabs show LOCKED for now.

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

export function UpgradesBoard({ view, act, title = true }: { view: GameView; act: Act; title?: boolean }): ReactNode {
  const [tab, setTab] = useState<Tab>("you");
  const tabs: Array<[Tab, string]> = [["you", t("tab.you")], ["bot", t("tab.bot")], ["machines", t("tab.machines")]];
  return (
    <>
      {title ? <div className="cc-title">{t("panel.upgrades")}</div> : null}
      <div className="cc-tabs">
        {tabs.map(([id, label]) => (
          <PxButton key={id} on={tab === id} disabled={id !== "you"} title={id !== "you" ? t("tab.locked") : undefined} onClick={() => setTab(id)}>
            {label}
          </PxButton>
        ))}
      </div>
      <div className="cc-scroll">
        {tab === "you" ? view.upgrades.map((u) => <UpgradeRow key={u.id} u={u} act={act} />) : <div className="cc-dim">{t("tab.locked")}</div>}
      </div>
    </>
  );
}
