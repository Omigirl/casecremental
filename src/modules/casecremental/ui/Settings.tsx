import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import { t } from "../i18n/index";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { PxButton, UiEnvContext } from "./parts";
import { getPrefs, setPrefs } from "./prefs";
import { replay } from "./tutorialRules";
import { useLang, usePrefs } from "./hooks";

// Settings: language (EN / RU, remembered), the music and sound volumes, and Replay tutorial.

export function Settings({
  onClose,
  onSoundBoard,
  onReset,
  onDevRun,
  onDevCash,
}: {
  onClose: () => void;
  onSoundBoard?: () => void;
  /** Dev builds: forget the save and start a fresh campaign. */
  onReset?: () => void;
  /** Dev builds: start Run 2 or 3 right away. */
  onDevRun?: (run: number) => void;
  /** Dev builds: add cash. */
  onDevCash?: () => void;
}): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const prefs = usePrefs();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) popElement(box.current);
  }, []);
  const slider = (label: string, value: number, set: (v: number) => void) => (
    <label style={{ display: "grid", gap: scale }}>
      <span>{label}</span>
      <input
        className="cc-slider"
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => set(Number(e.target.value) / 100)}
      />
    </label>
  );
  return (
    <div className="cc-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-label={t("settings.title")}
        style={{
          display: "grid",
          gap: 4 * scale,
          padding: 4 * scale,
          minWidth: "min(80vw, 22em)",
          ...frameCss(uiSpriteUrl("ui-frame"), scale),
        }}
      >
        <div className="cc-title">{t("settings.title")}</div>
        <div style={{ display: "grid", gap: scale }}>
          <span>{t("settings.language")}</span>
          <div className="cc-tabs">
            <PxButton on={lang === "en"} onClick={() => setPrefs({ lang: "en" })}>
              EN
            </PxButton>
            <PxButton on={lang === "ru"} onClick={() => setPrefs({ lang: "ru" })}>
              RU
            </PxButton>
          </div>
        </div>
        {slider(t("settings.music"), prefs.music, (music) => setPrefs({ music }))}
        {slider(t("settings.sfx"), prefs.sfx, (sfx) => setPrefs({ sfx }))}
        <PxButton
          onClick={() => {
            setPrefs({ tutorial: replay(getPrefs().tutorial) });
            onClose();
          }}
        >
          {t("tut.replay")}
        </PxButton>
        {onSoundBoard ? <PxButton onClick={onSoundBoard}>SOUND BOARD (DEV)</PxButton> : null}
        {onReset ? <PxButton onClick={onReset}>RESET PROGRESS (DEV)</PxButton> : null}
        {onDevRun ? (
          <div className="cc-tabs">
            <PxButton onClick={() => onDevRun(2)}>{t("settings.devRun2")}</PxButton>
            <PxButton onClick={() => onDevRun(3)}>{t("settings.devRun3")}</PxButton>
            <PxButton onClick={() => onDevRun(4)}>{t("settings.devRun4")}</PxButton>
            {onDevCash ? <PxButton onClick={onDevCash}>{t("settings.devCash")}</PxButton> : null}
          </div>
        ) : null}
        <PxButton onClick={onClose}>{t("settings.close")}</PxButton>
      </div>
    </div>
  );
}
