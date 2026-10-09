import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import type { Action } from "../game/controller";
import type { PrestigeView } from "../game/view";
import { charmDesc, charmName, perkDesc, perkName } from "../i18n/content";
import { t } from "../i18n/index";
import { PixelGear, PxButton, UiEnvContext } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { charmChoices } from "./prestigeRules";

// After the vault (M2b spec §8): the CLOUT it paid, the Vault I trophy, three charms to pick for the next
// run, the perks to buy with CLOUT, and "Start next run".

type Act = (a: Action) => void;

export function Prestige({ p, act, onSettings }: { p: PrestigeView; act: Act; onSettings: () => void }): ReactNode {
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
        aria-label={t("prestige.title")}
        style={{
          display: "grid",
          gap: 3 * scale,
          padding: 4 * scale,
          width: "min(92vw, 36em)",
          maxHeight: "92%",
          overflowY: "auto",
          ...frameCss(uiSpriteUrl("ui-frame"), scale),
        }}
      >
        <div className="cc-row-line">
          <div className="cc-title">{t("prestige.title")}</div>
          {/* the HUD is gone here, and this screen waits with its own music: mute or switch language from it */}
          <PxButton onClick={onSettings} title={t("hud.settings")} style={{ lineHeight: 1 }}>
            <PixelGear />
          </PxButton>
        </div>
        <div className="cc-row-line">
          <span className="cc-gold">{t("prestige.gained", { n: p.gained })}</span>
          <span className="cc-dim">{t("prestige.total", { n: p.clout })}</span>
        </div>
        <div style={{ color: "#ffd34d" }}>{t("prestige.trophy")}</div>
        <div className="cc-title">{t("prestige.charms", { n: p.slots })}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10em, 1fr))", gap: 2 * scale }}>
          {charmChoices(p).map((c) => (
            <div key={c.id} className="cc-row">
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
