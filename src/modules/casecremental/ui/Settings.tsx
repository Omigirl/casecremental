import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import { t } from "../i18n/index";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { PxButton, UiEnvContext } from "./parts";
import { setPrefs } from "./prefs";
import { useLang, usePrefs } from "./hooks";

// Settings: language (EN / RU, remembered) and the music and sound volumes.

export function Settings({
  onClose,
  onSoundBoard,
  onReset,
}: {
  onClose: () => void;
  onSoundBoard?: () => void;
  /** Dev builds: forget the save and start a fresh campaign. */
  onReset?: () => void;
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
        {onSoundBoard ? <PxButton onClick={onSoundBoard}>SOUND BOARD (DEV)</PxButton> : null}
        {onReset ? <PxButton onClick={onReset}>RESET PROGRESS (DEV)</PxButton> : null}
        <PxButton onClick={onClose}>{t("settings.close")}</PxButton>
      </div>
    </div>
  );
}
