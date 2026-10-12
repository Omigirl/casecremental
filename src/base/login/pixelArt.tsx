import type { CSSProperties, ReactNode } from "react";

// Pixel art of the sign-in screen: one-colour glyphs drawn from ASCII rows (the same technique as the
// game's settings gear, src/modules/casecremental/ui/parts.tsx — copied, the base cannot import a module),
// and frames of the game's sprite strips (copied into ./assets).
//
// Sizes are in "world pixels" multiplied by the CSS variable --s (the screen's integer pixel scale),
// so every cell stays a whole number of screen pixels.

type Run = { x: number; y: number; w: number };

export interface Glyph {
  w: number;
  h: number;
  runs: readonly Run[];
}

/** ASCII rows ("#" = filled) → horizontal runs, one <rect> each. */
export function glyph(rows: readonly string[]): Glyph {
  return {
    w: Math.max(...rows.map((r) => r.length)),
    h: rows.length,
    runs: rows.flatMap((row, y) =>
      [...row.matchAll(/#+/g)].map((m) => ({
        x: m.index ?? 0,
        y,
        w: m[0].length,
      })),
    ),
  };
}

const rects = (g: Glyph, fill: string): string =>
  g.runs
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${fill}"/>`,
    )
    .join("");

/** A glyph as an SVG data URL in a square box (for a button's background icon), centred. */
export function glyphDataUrl(g: Glyph, fill: string): string {
  const size = Math.max(g.w, g.h);
  const dx = (size - g.w) / 2;
  const dy = (size - g.h) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><g transform="translate(${dx} ${dy})">${rects(g, fill)}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A glyph drawn inline, `cell` CSS length per cell (default: one world pixel, var(--s) px). */
export function PixelGlyph({
  g,
  fill = "currentColor",
  cell = "calc(var(--s) * 1px)",
  style,
}: {
  g: Glyph;
  fill?: string;
  cell?: string;
  style?: CSSProperties;
}): ReactNode {
  return (
    <svg
      viewBox={`0 0 ${g.w} ${g.h}`}
      width={g.w}
      height={g.h}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{
        display: "block",
        width: `calc(${cell} * ${g.w})`,
        height: `calc(${cell} * ${g.h})`,
        ...style,
      }}
    >
      {g.runs.map((r) => (
        <rect
          key={`${r.x},${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={fill}
        />
      ))}
    </svg>
  );
}

// ---- Weapon silhouettes for the skin cards of the background reel (they point right).

export const WEAPONS = {
  rifle: glyph([
    "..................#...",
    "##....################",
    "######################",
    "#########.####........",
    "###...##..###.........",
    "##....##...###........",
    "#.....##....##........",
    "............#.........",
  ]),
  pistol: glyph([
    "...........#",
    "############",
    "############",
    "#####.#.....",
    "####.##.....",
    "####........",
    "####........",
    "###.........",
  ]),
  smg: glyph([
    "....###########.",
    "################",
    "################",
    "..####.###......",
    "..###..###......",
    "..##...###......",
    ".......###......",
  ]),
  sniper: glyph([
    "........######..........",
    ".........#..#...........",
    "##...###################",
    "####################....",
    "####..####..............",
    "###...##................",
    "##......................",
  ]),
  knife: glyph([
    "......##########....",
    "####.#############..",
    "####.###############",
    "####.##########.....",
    "......#####.........",
  ]),
} as const;

export type WeaponId = keyof typeof WEAPONS;

// ---- Button icons (one colour each; the screen paints them with the button's text colour).

export const ICONS = {
  wallet: glyph([
    "########..",
    "#.......#.",
    "#....#####",
    "#....#..##",
    "#....#####",
    "#.......#.",
    "#########.",
  ]),
  email: glyph([
    "##########",
    "##......##",
    "#.#....#.#",
    "#..#..#..#",
    "#...##...#",
    "#........#",
    "##########",
  ]),
  guest: glyph([
    "...###...",
    "..#####..",
    "..#####..",
    "..#####..",
    "...###...",
    ".........",
    ".#######.",
    "#########",
    "#########",
  ]),
  tickOff: glyph([
    "#######",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#######",
  ]),
  tickOn: glyph([
    "#######",
    "#....##",
    "#...#.#",
    "##.#..#",
    "#.#...#",
    "#.....#",
    "#######",
  ]),
} as const;

// ---- Sprite strips (./assets, copied from the game's built sprites).

export interface Strip {
  url: string;
  frameW: number;
  frameH: number;
  frames: number;
}

/** A window into a frame, in the frame's own pixels (the art without the headroom of its animation). */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One frame of a strip at `scale` (a unitless CSS multiplier, default var(--s)), optionally cropped.
 * `spin` steps through every frame (CSS animation ccl-strip) in that many seconds instead (uncropped).
 */
export function Sprite({
  strip,
  frame = 0,
  scale = "var(--s)",
  crop,
  spin,
  className,
  style,
}: {
  strip: Strip;
  frame?: number;
  scale?: string;
  crop?: Crop;
  spin?: number;
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  const px = (n: number): string => `calc(${scale} * ${n}px)`;
  const c = crop ?? { x: 0, y: 0, w: strip.frameW, h: strip.frameH };
  const sheetW = px(strip.frameW * strip.frames);
  return (
    <span
      aria-hidden="true"
      className={["ccl-sprite", spin ? "ccl-strip" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          width: px(c.w),
          height: px(c.h),
          backgroundImage: `url("${strip.url}")`,
          backgroundSize: `${sheetW} ${px(strip.frameH)}`,
          backgroundPosition: `${px(-(frame * strip.frameW + c.x))} ${px(-c.y)}`,
          "--sheet-w": sheetW,
          "--frames": strip.frames,
          animationDuration: spin ? `${spin}s` : undefined,
          ...style,
        } as CSSProperties
      }
    />
  );
}
