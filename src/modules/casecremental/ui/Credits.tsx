import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Action } from "../game/controller";
import type { PrestigeView } from "../game/view";
import { getLang, t } from "../i18n/index";
import { creditLines, creditsOver, scrollY, SKIP_AFTER_SECONDS } from "./creditsRules";
import { PxButton } from "./parts";

// The credits after The Last Case (finish spec §7.4): black, a slow scroll over CREDITS_SECONDS, SKIP after 5 s; the
// end (or SKIP) sends endCredits and the prestige screen follows. The scroll moves by a requestAnimationFrame loop on a
// ref (no React render per frame). A reload starts them over: the meta holds them until they end.

export function Credits({ p, act }: { p: PrestigeView; act: (a: Action) => void }): ReactNode {
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
      if (creditsOver(elapsed)) return act({ type: "endCredits" });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const timer = setTimeout(() => setSkippable(true), SKIP_AFTER_SECONDS * 1000); // canSkip's 5 s
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
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
