import type { ReactNode } from "react";
import type { AutoSpinView, GameView } from "../game/view";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { delaySeconds, statusKey } from "./autoSpinRules";
import type { Act } from "./machineRules";
import { PxButton } from "./parts";

// Auto-spin's rows on the Machines tab (finish spec §3, Run 1+): buy it once the auto-seller is on ("Needs
// auto-seller" before), then its ON/OFF switch with what it is doing, and its Delay. The case shelf shows the same
// switch beside BUY (AutoSpinSwitch).

/** ON/OFF: lit while on; disabled while the vault is out or the run is over. */
export function AutoSpinSwitch({ a, act }: { a: AutoSpinView; act: Act }): ReactNode {
  return (
    <PxButton on={a.on} disabled={!a.canToggle} onClick={() => act({ type: "setAutoSpin", on: !a.on })}>
      {t(a.on ? "autospin.on" : "autospin.off")}
    </PxButton>
  );
}

export function AutoSpinRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const a = view.autoSpin;
  const lang = getLang();
  if (!a.owned)
    return (
      <div className="cc-row">
        <div>{t("autospin.name")}</div>
        <div className="cc-dim">{a.needsSeller ? t("autospin.needs") : t("autospin.desc")}</div>
        <PxButton disabled={!a.canBuy} onClick={() => act({ type: "buyAutoSpin" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(a.cost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("autospin.name")}</div>
        <div className="cc-dim">{t(statusKey(a.status))}</div>
        <AutoSpinSwitch a={a} act={act} />
      </div>
      <div className="cc-row">
        <div className="cc-dim">{t("autospin.delay", { s: delaySeconds(a.delay, lang) })}</div>
        {a.delayCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!a.canBuyDelay} onClick={() => act({ type: "buyAutoSpinDelay" })}>
            {formatCash(a.delayCost, lang)}
          </PxButton>
        )}
      </div>
    </>
  );
}
