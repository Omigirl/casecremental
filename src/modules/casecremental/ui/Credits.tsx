import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { PrestigeView } from "../game/view";
import { getLang, t } from "../i18n/index";
import { canSkip, creditLines, creditsOver, scrollY } from "./creditsRules";
import { PixelGear, PxButton } from "./parts";

// The credits after The Last Case (finish spec §7.4): black, a slow scroll over CREDITS_SECONDS, SKIP after 5 s; the
// end (or SKIP) sends endCredits and the prestige screen follows. The scroll moves by a requestAnimationFrame loop on a
// ref (no React render per frame). A reload starts them over: the meta holds them until they end.

export function Credits({ p, act, onSettings }: { p: PrestigeView; act: (a: Action) => void; onSettings: () => void }): ReactNode {
  const col = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [skippable, setSkippable] = useState(false);
  const lang = getLang();
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const frame = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (col.current && box.current)
        col.current.style.transform = `translateY(${scrollY(elapsed, col.current.offsetHeight, box.current.offsetHeight)}px)`;
      if (canSkip(elapsed)) setSkippable(true); // no-op once set
      if (creditsOver(elapsed)) return act({ type: "endCredits" });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [act]);
  return (
    <div
      ref={box}
      className="cc-modal"
      style={{ background: "#000", overflow: "hidden", placeItems: "initial" }}
      role="dialog"
      aria-label={t("credits.thanks")}
    >
      <div
        ref={col}
        lang={lang}
        style={{
          position: "absolute",
          left: "calc(var(--px) * 4px)",
          right: "calc(var(--px) * 4px)",
          top: 0,
          display: "grid",
          justifyItems: "center",
          gap: "calc(var(--fs) * 0.8)",
          textAlign: "center",
          transform: "translateY(100vh)", // below the screen until the first frame places it
        }}
      >
        {creditLines(p.stats, lang).map((l, i) =>
          l.kind === "gap" ? (
            <div key={i} style={{ height: "calc(var(--fs) * 3)" }} />
          ) : (
            <div
              key={i}
              className={l.kind === "head" ? "cc-dim" : undefined}
              style={{ color: l.color, fontSize: l.kind === "title" ? "calc(var(--fs) * 3)" : undefined }}
            >
              {l.text}
            </div>
          ),
        )}
      </div>
      {/* the HUD is gone here: mute or switch language during the 70 s */}
      <PxButton
        onClick={onSettings}
        title={t("hud.settings")}
        style={{ position: "absolute", right: "calc(var(--px) * 6px)", top: "calc(var(--px) * 6px)", lineHeight: 1 }}
      >
        <PixelGear />
      </PxButton>
      {skippable ? (
        <PxButton
          style={{ position: "absolute", right: "calc(var(--px) * 6px)", bottom: "calc(var(--px) * 6px)" }}
          onClick={() => act({ type: "endCredits" })}
        >
          {t("btn.skip")}
        </PxButton>
      ) : null}
    </div>
  );
}
