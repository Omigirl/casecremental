import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from "react";
import { springElement } from "../fx/hd/tween";
import type { Rect } from "../fx/pixel/layout";
import { frameCss, uiSpriteUrl } from "./pixelFrame";

// Small building blocks shared by the panels: a pixel button that presses in and springs back,
// a progress bar, a framed panel placed over a world-pixel rect, and the settings gear.

export interface UiEnv {
  scale: number;
  /** The ui-button art was sliced and applied (CSS variables on the root). */
  skinnedButtons: boolean;
  /** Button press sound. */
  click: () => void;
}

export const UiEnvContext = createContext<UiEnv>({ scale: 1, skinnedButtons: false, click: () => {} });

export function PxButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  on?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
}): ReactNode {
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
        env.click();
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

/** The settings gear as pixel art (the pixel font has no ⚙): 9×9 in the text colour, one cell per font pixel
 *  (the text size is a multiple of 8 px, so 9/8 em keeps every cell whole). */
const GEAR = ["....#....", ".#.###.#.", "..#####..", ".##...##.", "###...###", ".##...##.", "..#####..", ".#.###.#.", "....#...."];
type Run = { x: number; y: number; w: number };
const glyphRuns = (rows: readonly string[]): Run[] =>
  rows.flatMap((row, y) => [...row.matchAll(/#+/g)].map((m) => ({ x: m.index ?? 0, y, w: m[0].length })));

/** A pixel glyph in the text colour, one cell per font pixel (the text size is a multiple of 8, so n/8 em keeps
 *  every cell whole). */
function PixelGlyph({ runs, size }: { runs: readonly Run[]; size: number }): ReactNode {
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={`${size / 8}em`}
      height={`${size / 8}em`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {runs.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill="currentColor" />
      ))}
    </svg>
  );
}

const GEAR_RUNS = glyphRuns(GEAR);
const TICK_OFF = glyphRuns(["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######"]);
const TICK_ON = glyphRuns(["#######", "#....##", "#...#.#", "##.#..#", "#.#...#", "#.....#", "#######"]);

export function PixelGear(): ReactNode {
  return <PixelGlyph runs={GEAR_RUNS} size={9} />;
}

/** The shelf's tick box (the auto-buyer buys a ticked case). */
export function PixelTick({ on }: { on: boolean }): ReactNode {
  return <PixelGlyph runs={on ? TICK_ON : TICK_OFF} size={7} />;
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
