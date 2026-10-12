import { useContext, type ReactNode } from "react";
import { spriteIndex } from "../fx/pixel/sprites";
import type { CaseView, GameView } from "../game/view";
import { caseName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { vaultFor } from "../sim/content/vaults";
import { formatCash } from "../sim/format";
import { AutoSpinSwitch } from "./AutoSpinRows";
import { statusKey } from "./autoSpinRules";
import { dayJobButton } from "./dayJob";
import { boardOpen, type Act } from "./machineRules";
import { Bar, PixelTick, PxButton, UiEnvContext } from "./parts";
import { stripFrameCss } from "./pixelFrame";
import { framedCase, picksShown, shelfUrgent, shelfIconK } from "./shelfFit";

// The Case shelf (right panel, or a drawer tab on phones): each case with its pixel box, BUY at
// its price or UNLOCK at its unlock cost. Every button sends an Action through the controller.

/** The closed case is ~20 px tall; its sprite cell keeps headroom for the opening lid, cropped off here. */
const CASE_ICON_ROWS = 22;

function CaseIcon({ c }: { c: CaseView }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const k = shelfIconK(scale);
  const css = stripFrameCss(spriteIndex().get(`case-${c.id}`), 0, k, CASE_ICON_ROWS);
  const style = css ?? { width: 13 * k, height: 10 * k, background: c.color, boxShadow: `0 0 0 ${k}px #120e10` };
  return <div style={{ ...style, flex: "none", opacity: c.unlocked ? 1 : 0.4 }} />;
}

/** The case's icon as auto-spin's pick button: a tick box in its corner shows (and sets) the pick, so the control costs
 *  the row no height and no width. The whole icon is the touch target; a gold frame marks the case it buys. */
function PickIcon({ c, act, open }: { c: CaseView; act: Act; open: boolean }): ReactNode {
  const env = useContext(UiEnvContext);
  return (
    <button
      type="button"
      className="cc-pick"
      disabled={!open}
      aria-pressed={c.picked}
      aria-label={t("shelf.pick")}
      title={t("shelf.pick")}
      onClick={() => {
        env.click();
        act({ type: "setAutoSpinCase", caseId: c.id });
      }}
    >
      <CaseIcon c={c} />
      <span className={c.picked ? "cc-pick-box on" : "cc-pick-box"}>
        <PixelTick on={c.picked} />
      </span>
    </button>
  );
}

/** Auto-spin's switch beside the BUY buttons (finish spec §3), and BROKE or "Waits: vault" under it. */
function AutoSpinRow({ view, act }: { view: GameView; act: Act }): ReactNode {
  const a = view.autoSpin;
  if (!a.owned) return null;
  return (
    <div className="cc-row">
      <div>{t("autospin.name")}</div>
      <AutoSpinSwitch a={a} act={act} />
      {a.status === "broke" || a.status === "vault" ? <div className="cc-dim">{t(statusKey(a.status))}</div> : null}
    </div>
  );
}

function CaseRow({ c, act, picks, open, framed }: { c: CaseView; act: Act; picks: boolean; open: boolean; framed: boolean }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  return (
    <div className="cc-row" style={picks && framed ? { boxShadow: `0 0 0 ${scale}px #ffd34d inset` } : undefined}>
      <div className="cc-row-line">
        {picks && c.unlocked ? <PickIcon c={c} act={act} open={open} /> : <CaseIcon c={c} />}
        <span style={{ flex: 1 }}>{caseName(c.id)}</span>
      </div>
      {c.unlocked ? (
        <PxButton tut={`case:${c.id}`} disabled={!c.canBuy} onClick={() => act({ type: "buyCase", caseId: c.id })}>
          {t("btn.buy")}
          {c.count > 1 ? ` ×${c.count}` : ""}
          <span className="cc-btn-sub">{formatCash(c.price * c.count, getLang())}</span>
        </PxButton>
      ) : (
        <PxButton tut={`case:${c.id}`} disabled={!c.canUnlock} onClick={() => act({ type: "unlockCase", caseId: c.id })}>
          {t("btn.unlock")}
          <span className="cc-btn-sub">{formatCash(c.unlockCost, getLang())}</span>
        </PxButton>
      )}
    </div>
  );
}

/** Broke with an empty bench → a ~3 s day job: 90 % +$2, 10 % nothing (campaign spec §6.1). */
function DayJobRow({ view, act }: { view: GameView; act: Act }): ReactNode {
  const b = dayJobButton(view);
  if (!b) return null;
  return (
    <div className="cc-row">
      <PxButton disabled={!b.enabled} onClick={() => act({ type: "startDayJob" })}>
        {t("btn.dayjob")}
      </PxButton>
      {b.enabled ? null : <Bar progress={b.progress} />}
    </div>
  );
}

/** Vault Case I (rework spec §4): shown once every case is unlocked; buying it takes the screen. */
function VaultRow({ view, act }: { view: GameView; act: Act }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const v = view.vault;
  if (!v.shown) return null;
  const k = shelfIconK(scale);
  const css = stripFrameCss(spriteIndex().get(`case-${vaultFor(view.run).sourceCase}`), 0, k, CASE_ICON_ROWS);
  const icon = css ?? { width: 13 * k, height: 10 * k, background: "#ffd34d" };
  return (
    <div className="cc-row" style={{ boxShadow: `0 0 0 ${scale}px #ffd34d inset` }}>
      <div className="cc-row-line">
        <div style={{ ...icon, flex: "none", filter: "sepia(1) saturate(4) brightness(1.15)" }} />
        <span style={{ flex: 1, color: "#ffd34d" }}>{caseName(v.id)}</span>
      </div>
      <PxButton tut="vault" disabled={!v.canBuy} onClick={() => act({ type: "buyVault" })}>
        {t("btn.buy")}
        <span className="cc-btn-sub">{formatCash(v.price, getLang())}</span>
      </PxButton>
      {v.blockedBy === "bench" ? <div className="cc-dim">{t("vault.busy")}</div> : null}
    </div>
  );
}

export function CaseShelf({ view, act, title = true }: { view: GameView; act: Act; title?: boolean }): ReactNode {
  const framed = framedCase(view.cases, view.autoSpin.status);
  const urgent = shelfUrgent(view, dayJobButton(view) !== null);
  return (
    <>
      {title ? <div className="cc-title">{t("panel.cases")}</div> : null}
      <div className="cc-scroll">
        <AutoSpinRow view={view} act={act} />
        {/* what needs you now comes first, so it never sits below the fold of a long shelf */}
        {urgent ? <DayJobRow view={view} act={act} /> : null}
        {urgent ? <VaultRow view={view} act={act} /> : null}
        {view.cases.map((c) => (
          <CaseRow key={c.id} c={c} act={act} picks={picksShown(view)} open={boardOpen(view)} framed={framed === c.id} />
        ))}
        {urgent ? null : <VaultRow view={view} act={act} />}
        {urgent ? null : <DayJobRow view={view} act={act} />}
      </div>
    </>
  );
}
