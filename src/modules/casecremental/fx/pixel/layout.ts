import type { PixelViewport } from "./viewport";

// Where everything sits on the workbench, in world pixels (spec §3). Landscape: Upgrades board on
// the left, Case shelf on the right (React panels drawn over these rects), the table between them.
// Portrait: no side panels (they become a drawer), the table fills the width.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Pt {
  x: number;
  y: number;
}

export interface TableLayout {
  worldW: number;
  worldH: number;
  portrait: boolean;
  hudH: number;
  panelL: Rect | null;
  panelR: Rect | null;
  table: Rect;
  lamp: Pt;
  you: {
    reel: Rect;
    mat: Rect;
    caseSpot: Pt;
    keyHome: Pt;
    reveal: Pt;
    /** Auto-spin's arm (finish spec §3): bolted to the mat's right end, clear of the case. */
    arm: Rect;
  };
  /** Where the bot's card waits. */
  bot: { reel: Rect | null; spot: Pt; reveal: Pt };
  tray: Rect;
  seller: Pt;
  bin: Pt;
  binR: number;
  /** The locker's cabinet (spec §5; dark before Run 2): the front edge, between the tray and the bin. */
  locker: Rect;
}

/** Nominal on-table sizes in world px (sprites are built to roughly these). */
export const ITEM_SIZE = {
  case: { w: 24, h: 20 },
  key: { w: 10, h: 10 },
  bot: { w: 40, h: 48 },
  seller: { w: 24, h: 30 },
  reveal: { w: 44, h: 30 },
  locker: { w: 24, h: 30 },
  arm: { w: 10, h: 18 },
} as const;

/** World px a side panel loses to chrome across its width: the frame (6 + 6), the panel padding
 *  (1 + 1), the row padding (1 + 1) and the button padding (1 + 1) — ui/styles.ts, ui/parts.tsx. */
export const PANEL_CHROME = 18;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = Math.round;

type Base = Omit<TableLayout, "locker">;

export function tableLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): TableLayout {
  const b = baseLayout(vp);
  const { w: lw, h: lh } = ITEM_SIZE.locker;
  const locker: Rect = { x: b.bin.x - b.binR - 3 - lw, y: b.bin.y + b.binR - lh, w: lw, h: lh };
  // the tray gives its right end to the locker (since M3)
  const tray: Rect = { ...b.tray, w: Math.min(b.tray.w, locker.x - 2 - b.tray.x) };
  return { ...b, tray, locker };
}

/** Auto-spin's arm stands on the mat's right end, its foot on the mat's bottom row; the mat is at least 48 px wide, so
 *  it always clears the case (26 px, centred). */
const armRect = (mat: Rect): Rect => ({
  x: mat.x + mat.w - 1 - ITEM_SIZE.arm.w,
  y: mat.y + mat.h - ITEM_SIZE.arm.h,
  w: ITEM_SIZE.arm.w,
  h: ITEM_SIZE.arm.h,
});

function baseLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): Base {
  const W = vp.worldW,
    H = vp.worldH,
    hudH = 18;
  if (!vp.portrait) {
    const P = clamp(r(W * 0.19), 64, 96);
    const table: Rect = { x: P + 4, y: 64, w: W - 2 * P - 8, h: H - 66 };
    const half = r(table.w * 0.5);
    const matW = clamp(r(table.w * 0.3), 48, 72),
      matCx = r(table.x + table.w * 0.28);
    const mat: Rect = { x: matCx - r(matW / 2), y: 92, w: matW, h: 22 };
    return {
      worldW: W,
      worldH: H,
      portrait: false,
      hudH,
      panelL: { x: 0, y: hudH, w: P, h: H - hudH },
      panelR: { x: W - P, y: hudH, w: P, h: H - hudH },
      table,
      lamp: { x: r(table.x + table.w / 2), y: 0 },
      you: {
        reel: { x: table.x + 4, y: 22, w: half - 8, h: 26 },
        mat,
        caseSpot: { x: matCx, y: 112 },
        keyHome: { x: Math.max(mat.x - 12, table.x + 6), y: 100 },
        reveal: { x: matCx, y: 72 },
        arm: armRect(mat),
      },
      bot: {
        reel: { x: table.x + half + 4, y: 22, w: table.w - half - 8, h: 26 },
        spot: { x: r(table.x + table.w * 0.74), y: 118 },
        reveal: { x: table.x + half + 4 + r((table.w - half - 8) * 0.3), y: 70 },
      },
      tray: { x: r(table.x + table.w * 0.27), y: H - 26, w: r(table.w * 0.46), h: 18 },
      seller: { x: table.x + 16, y: H - 6 },
      bin: { x: table.x + table.w - 14, y: H - 18 },
      binR: 12,
    };
  }
  const table: Rect = { x: 4, y: 56, w: W - 8, h: H - 58 };
  const matW = clamp(r(table.w * 0.3), 48, 72),
    matCx = r(W * 0.36);
  const mat: Rect = { x: matCx - r(matW / 2), y: 84, w: matW, h: 22 };
  return {
    worldW: W,
    worldH: H,
    portrait: true,
    hudH,
    panelL: null,
    panelR: null,
    table,
    lamp: { x: r(W / 2), y: 0 },
    you: {
      reel: { x: 8, y: 22, w: W - 16, h: 26 },
      mat,
      caseSpot: { x: matCx, y: 104 },
      keyHome: { x: mat.x - 12, y: 92 },
      reveal: { x: matCx, y: 66 },
      arm: armRect(mat),
    },
    bot: { reel: null, spot: { x: r(W * 0.76), y: 112 }, reveal: { x: Math.min(r(W * 0.7), W - 4 - ITEM_SIZE.reveal.w / 2), y: 66 } },
    tray: { x: r(W * 0.25), y: H - 40, w: r(W * 0.5), h: 18 },
    seller: { x: 20, y: H - 14 },
    bin: { x: W - 18, y: H - 30 },
    binR: 12,
  };
}

/** Your reel window: one reel's window, or — for n > 1 while the reels spin — a tall window reaching down to
 *  just above the mat (the cards are not up yet). Landed, it settles back to the one-reel height. */
export function benchReelArea(l: TableLayout, n: number, tall: boolean): Rect {
  const r = l.you.reel;
  if (n <= 1) return r;
  if (tall) return { ...r, h: l.you.mat.y - 1 - r.y };
  return { ...r, h: Math.max(r.h, l.you.reveal.y - ITEM_SIZE.reveal.h / 2 - 2 - r.y) };
}

/** Where n bench cards sit, side by side around you.reveal, left to right. They stay on the table and left of
 *  the bot's card; where that is too narrow (portrait) they overlap rather than cross those limits. */
export function revealSpots(l: TableLayout, n: number): Pt[] {
  if (n <= 1) return [l.you.reveal];
  const w = ITEM_SIZE.reveal.w;
  const lo = l.table.x + 1 + w / 2; // the leftmost card's centre
  const hi = l.bot.reveal.x - w / 2 - 1 - w / 2; // the rightmost card's centre
  const step = Math.max(0, Math.floor(Math.min(w + 2, (hi - lo) / (n - 1))));
  const span = step * (n - 1);
  const x0 = Math.round(clamp(l.you.reveal.x - span / 2, lo, hi - span));
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * step, y: l.you.reveal.y }));
}

/** Where the bot's n cards wait (spec §4): the first on bot.reveal, a second to its right — overlapping it where the
 *  table is narrow, never by more than 38 px (6 px of it always shows to grab) and never past the table's edge. */
export function botRevealSpots(l: Pick<TableLayout, "bot" | "table">, n: number): Pt[] {
  if (n <= 1) return [l.bot.reveal];
  const w = ITEM_SIZE.reveal.w;
  const room = l.table.x + l.table.w - 1 - w / 2 - l.bot.reveal.x;
  const step = Math.round(clamp(room / (n - 1), 6, w + 2));
  return Array.from({ length: n }, (_, i) => ({ x: l.bot.reveal.x + i * step, y: l.bot.reveal.y }));
}

/** The bot's reel window: its one reel, or — for a double spin — a window reaching down to just above its cards'
 *  spot (no card waits there while it spins). Null where the bot has no reel (portrait). */
export function botReelArea(l: Pick<TableLayout, "bot">, n: number): Rect | null {
  const r = l.bot.reel;
  if (!r || n <= 1) return r;
  return { ...r, h: Math.max(r.h, l.bot.reveal.y - ITEM_SIZE.reveal.h / 2 - 2 - r.y) };
}

/** Where n contract results wait (spec §5: "on the locker"): centred on the cabinet, the card's bottom 6 px into its
 *  top, but never up into the bot's station; a Contract Killer pair fans 8 px apart. */
export function lockerCardSpots(l: Pick<TableLayout, "locker" | "bot">, n: number): Pt[] {
  const { h } = ITEM_SIZE.reveal;
  const cx = l.locker.x + l.locker.w / 2;
  const y = Math.max(l.locker.y + 6 - h, l.bot.spot.y + 1) + h / 2;
  return Array.from({ length: Math.max(1, n) }, (_, i) => ({ x: cx + Math.round((i - (Math.max(1, n) - 1) / 2) * 8), y }));
}
