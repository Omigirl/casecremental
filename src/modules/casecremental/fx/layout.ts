// Where everything sits on the canvas, for any screen size. The React HUD covers the top
// HUD_HEIGHT pixels and the shop panel the bottom SHOP_FRACTION of the screen; the play area is
// what is left between them.

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const HUD_HEIGHT = 96;
export const SHOP_FRACTION = 0.36;
export const GUTTER = 16;
export const KEY_RADIUS = 28;

export interface Layout {
  width: number;
  height: number;
  playBottom: number;
  itemW: number;
  itemH: number;
  reel: Rect;
  bench: Point;
  caseSize: { w: number; h: number };
  revealSize: { w: number; h: number };
  lock: Point;
  keyHome: Point;
  sellBin: Point & { r: number };
  cashTarget: Point;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function computeLayout(width: number, height: number): Layout {
  const playBottom = height * (1 - SHOP_FRACTION);
  const playH = playBottom - HUD_HEIGHT;

  const itemW = clamp(Math.min((width - 2 * GUTTER) / 5, (playH * 0.35) / 0.75), 72, 150);
  const itemH = Math.round(itemW * 0.75);
  const reelW = Math.min(width - 2 * GUTTER, itemW * 7);
  const reel: Rect = { x: (width - reelW) / 2, y: HUD_HEIGHT + 8, w: reelW, h: itemH + 16 };
  const reelBottom = reel.y + reel.h;

  const below = playBottom - reelBottom;
  const caseW = clamp(Math.min(width * 0.22, (below * 0.7) / 0.62), 60, 180);
  const caseSize = { w: caseW, h: caseW * 0.62 };
  const revealSize = { w: caseW * 1.6, h: caseSize.h * 1.4 };
  const bench = { x: width / 2, y: reelBottom + below / 2 };

  const sellR = clamp(width * 0.06, 32, 56);
  const side = Math.min(width / 2 - GUTTER - sellR - 4, revealSize.w / 2 + 110);

  return {
    width,
    height,
    playBottom,
    itemW,
    itemH,
    reel,
    bench,
    caseSize,
    revealSize,
    lock: { x: bench.x, y: bench.y - caseSize.h * 0.1 },
    keyHome: { x: bench.x - side, y: bench.y },
    sellBin: { x: bench.x + side, y: bench.y, r: sellR },
    cashTarget: { x: width / 2, y: 30 },
  };
}

/** Whether a point is over the case on the bench, with some slack — where a dropped key counts. */
export function overCase(l: Layout, p: Point, slack = 24): boolean {
  return (
    Math.abs(p.x - l.bench.x) <= l.caseSize.w / 2 + slack &&
    Math.abs(p.y - l.bench.y) <= l.caseSize.h / 2 + slack
  );
}
