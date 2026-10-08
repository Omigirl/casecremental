import type { PixelViewport } from "./viewport";

// Where everything sits on the workbench, in world pixels (spec §3). Landscape: Upgrades board on
// the left, Case shelf on the right (React panels drawn over these rects), the table between them.
// Portrait: no side panels (they become a drawer), the table fills the width.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export interface TableLayout {
  worldW: number;
  worldH: number;
  portrait: boolean;
  hudH: number;
  panelL: Rect | null;
  panelR: Rect | null;
  table: Rect;
  lamp: Pt;
  you: { reel: Rect; mat: Rect; caseSpot: Pt; keyHome: Pt; reveal: Pt };
  bot: { reel: Rect | null; spot: Pt };
  tray: Rect;
  seller: Pt;
  bin: Pt;
  binR: number;
}

/** Nominal on-table sizes in world px (sprites are built to roughly these). */
export const ITEM_SIZE = {
  case: { w: 24, h: 20 },
  key: { w: 10, h: 10 },
  bot: { w: 40, h: 48 },
  seller: { w: 24, h: 30 },
  reveal: { w: 44, h: 30 },
} as const;

/** World px a side panel loses to chrome across its width: the frame (6 + 6), the panel padding
 *  (1 + 1), the row padding (1 + 1) and the button padding (1 + 1) — ui/styles.ts, ui/parts.tsx. */
export const PANEL_CHROME = 18;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = Math.round;

export function tableLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): TableLayout {
  const W = vp.worldW, H = vp.worldH, hudH = 18;
  if (!vp.portrait) {
    const P = clamp(r(W * 0.19), 64, 96);
    const table: Rect = { x: P + 4, y: 64, w: W - 2 * P - 8, h: H - 66 };
    const half = r(table.w * 0.5);
    const matW = clamp(r(table.w * 0.3), 48, 72), matCx = r(table.x + table.w * 0.28);
    const mat: Rect = { x: matCx - r(matW / 2), y: 92, w: matW, h: 22 };
    return {
      worldW: W, worldH: H, portrait: false, hudH,
      panelL: { x: 0, y: hudH, w: P, h: H - hudH },
      panelR: { x: W - P, y: hudH, w: P, h: H - hudH },
      table,
      lamp: { x: r(table.x + table.w / 2), y: 0 },
      you: { reel: { x: table.x + 4, y: 22, w: half - 8, h: 26 }, mat, caseSpot: { x: matCx, y: 112 }, keyHome: { x: Math.max(mat.x - 12, table.x + 6), y: 100 }, reveal: { x: matCx, y: 72 } },
      bot: { reel: { x: table.x + half + 4, y: 22, w: table.w - half - 8, h: 26 }, spot: { x: r(table.x + table.w * 0.74), y: 118 } },
      tray: { x: r(table.x + table.w * 0.27), y: H - 26, w: r(table.w * 0.46), h: 18 },
      seller: { x: table.x + 16, y: H - 6 },
      bin: { x: table.x + table.w - 14, y: H - 18 },
      binR: 12,
    };
  }
  const table: Rect = { x: 4, y: 56, w: W - 8, h: H - 58 };
  const matW = clamp(r(table.w * 0.3), 48, 72), matCx = r(W * 0.36);
  const mat: Rect = { x: matCx - r(matW / 2), y: 84, w: matW, h: 22 };
  return {
    worldW: W, worldH: H, portrait: true, hudH,
    panelL: null, panelR: null,
    table,
    lamp: { x: r(W / 2), y: 0 },
    you: { reel: { x: 8, y: 22, w: W - 16, h: 26 }, mat, caseSpot: { x: matCx, y: 104 }, keyHome: { x: mat.x - 12, y: 92 }, reveal: { x: matCx, y: 66 } },
    bot: { reel: null, spot: { x: r(W * 0.76), y: 112 } },
    tray: { x: r(W * 0.25), y: H - 40, w: r(W * 0.5), h: 18 },
    seller: { x: 20, y: H - 14 },
    bin: { x: W - 18, y: H - 30 },
    binR: 12,
  };
}
