import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from "react";
import { springElement } from "../fx/hd/tween";
import type { Rect } from "../fx/pixel/layout";
import { frameCss, uiSpriteUrl } from "./pixelFrame";

// Small building blocks shared by the panels: a pixel button that presses in and springs back,
// a progress bar, and a framed panel placed over a world-pixel rect.

export interface UiEnv {
  scale: number;
  /** The ui-button art was sliced and applied (CSS variables on the root). */
  skinnedButtons: boolean;
}

export const UiEnvContext = createContext<UiEnv>({ scale: 1, skinnedButtons: false });

export function PxButton(props: { onClick?: () => void; disabled?: boolean; on?: boolean; children: ReactNode; style?: CSSProperties; title?: string }): ReactNode {
  const env = useContext(UiEnvContext);
  const ref = useRef<HTMLButtonElement>(null);
  const cls = ["cc-btn", env.skinnedButtons ? "skinned" : "", props.on ? "on" : ""].filter(Boolean).join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      disabled={props.disabled}
      aria-pressed={props.on}
      title={props.title}
      style={props.style}
      onClick={() => {
        if (ref.current) springElement(ref.current);
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Bar({ progress }: { progress: number }): ReactNode {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={p >= 1 ? "cc-bar done" : "cc-bar"}>
      <div style={{ width: `${Math.round(p * 100)}%` }} />
    </div>
  );
}

/** A framed panel over a rect given in world px. */
export function Panel({ rect, children, style }: { rect: Rect; children: ReactNode; style?: CSSProperties }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  return (
    <div
      className="cc-panel"
      style={{
        left: rect.x * scale,
        top: rect.y * scale,
        width: rect.w * scale,
        height: rect.h * scale,
        padding: scale,
        ...frameCss(uiSpriteUrl("ui-frame"), scale),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
