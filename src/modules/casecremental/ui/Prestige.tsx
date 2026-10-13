import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import type { Action } from "../game/controller";
import type { PrestigeView } from "../game/view";
import { charmDesc, charmName, perkDesc, perkName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import type { VaultDef } from "../sim/content/vaults";
import { PixelGear, PxButton, UiEnvContext } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { bringText, charmChoices, prestigeTitle, runBrings, trophyLine } from "./prestigeRules";

// After the vault (M2b spec §8; after The Last Case: THE END, finish spec §7.4): the CLOUT it paid, the opened vault's
// trophy, what the next run brings (or THE END and Run 4 again), three charms to pick for the next run, the perks to buy
// with CLOUT, and "Start next run".

type Act = (a: Action) => void;

export function Prestige({
  p,
  vault,
  act,
  onSettings,
}: {
  p: PrestigeView;
  vault: VaultDef["id"];
  act: Act;
  onSettings: () => void;
}): ReactNode {
  const title = prestigeTitle(vault);
  const { scale } = useContext(UiEnvContext);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) popElement(box.current);
  }, []);
  return (
    <div className="cc-modal">
      <div
        ref={box}
        role="dialog"
        aria-label={title}
        style={{
          display: "grid",
          gap: 3 * scale,
          padding: 4 * scale,
          width: "min(92vw, 44em)", // three charm cards side by side, each wide enough for its longest word (F9)
          maxHeight: "92%",
          overflowY: "auto",
          ...frameCss(uiSpriteUrl("ui-frame"), scale),
        }}
      >
        <div className="cc-row-line">
          <div className="cc-title">{title}</div>
          {/* the HUD is gone here, and this screen waits with its own music: mute or switch language from it */}
          <PxButton onClick={onSettings} title={t("hud.settings")} style={{ lineHeight: 1 }}>
            <PixelGear />
          </PxButton>
        </div>
        <div className="cc-row-line">
          <span className="cc-gold">{t("prestige.gained", { n: p.gained })}</span>
          <span className="cc-dim">{t("prestige.total", { n: p.clout })}</span>
        </div>
        <div style={{ color: "#ffd34d" }}>{trophyLine(vault)}</div>
        <div className="cc-title">{t("prestige.nextrun", { n: p.nextRun })}</div>
        {p.replay ? (
          <>
            {/* gold like the HUD's cash: cc-title's shadow would show through the clipped (transparent) text */}
            <div className="cc-gold" style={{ fontSize: "calc(var(--fs) * 2)", lineHeight: 1.2, textAlign: "center" }}>
              {t("prestige.end")}
            </div>
            <div style={{ textAlign: "center" }}>{t("prestige.again", { n: p.nextRun })}</div>
          </>
        ) : (
          <div style={{ display: "grid", gap: scale }}>
            {runBrings(p.nextRun).map((b) => (
              <div key={b.kind === "case" ? b.caseId : b.id} className="cc-dim">
                {bringText(b)}
              </div>
            ))}
          </div>
        )}
        <div className="cc-title">{t("prestige.charms", { n: p.slots })}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10em, 1fr))", gap: 2 * scale }}>
          {charmChoices(p).map((c) => (
            // a long word (Барахольщик, коллекционера, Collector's) hyphenates (or, without a dictionary, breaks) inside
            // its own card, never running into the next one: "anywhere" (unlike "break-word") lowers the card's
            // min-content, and the card's one column may shrink below its longest word, so the card and its PICK
            // button keep to the grid's column
            <div
              key={c.id}
              lang={getLang()}
              className="cc-row"
              style={{ minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", hyphens: "auto", overflowWrap: "anywhere" }}
            >
              <div>{charmName(c.id)}</div>
              <div className="cc-dim">{charmDesc(c.id)}</div>
              <PxButton on={c.picked} disabled={!c.enabled} onClick={() => act({ type: "pickCharm", id: c.id })}>
                {c.picked ? t("btn.picked") : t("btn.pick")}
              </PxButton>
            </div>
          ))}
        </div>
        <div className="cc-title">{t("prestige.perks")}</div>
        {p.perks.map((k) => (
          <div key={k.id} className="cc-row">
            <div className="cc-row-line">
              <span>{perkName(k.id)}</span>
              <span className="cc-dim">{t("prestige.level", { n: k.level, max: k.maxLevel })}</span>
            </div>
            <div className="cc-dim">{perkDesc(k.id)}</div>
            {k.cost === null ? (
              <PxButton disabled>{t("btn.max")}</PxButton>
            ) : (
              <PxButton disabled={!k.canBuy} onClick={() => act({ type: "buyPerk", id: k.id })}>
                {t("prestige.cost", { n: k.cost })}
              </PxButton>
            )}
          </div>
        ))}
        <PxButton onClick={() => act({ type: "startNextRun" })}>{t("prestige.next")}</PxButton>
      </div>
    </div>
  );
}
