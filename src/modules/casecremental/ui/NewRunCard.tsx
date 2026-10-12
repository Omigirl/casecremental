import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import { t } from "../i18n/index";
import { UiEnvContext } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { cardText } from "./tutorialRules";

// The first time Run 2, 3 or 4 starts (finish spec §4): one card says what is new. One tap anywhere closes it.

export function NewRunCard({ run, onClose }: { run: number; onClose: () => void }): ReactNode {
  const { scale, click } = useContext(UiEnvContext);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) popElement(box.current);
  }, []);
  return (
    <div
      className="cc-modal"
      onClick={() => {
        click();
        onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-label={t("card.title", { n: run })}
        style={{
          display: "grid",
          gap: 3 * scale,
          padding: 4 * scale,
          width: "min(92vw, 30em)",
          ...frameCss(uiSpriteUrl("ui-frame"), scale),
        }}
      >
        <div className="cc-title">{t("card.title", { n: run })}</div>
        <div>{t(cardText(run))}</div>
        <div className="cc-dim" style={{ textAlign: "center" }}>
          {t("card.tap")}
        </div>
      </div>
    </div>
  );
}
