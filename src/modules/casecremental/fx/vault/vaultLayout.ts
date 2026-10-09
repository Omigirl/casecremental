import type { Pt, Rect, TableLayout } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";

// Where the vault's pieces go on screen (spec 2026-10-09 §2). While the key waits, the vault sits big in the
// centre with the devil key beside it (as before). Once the key turns, the chest is at lower centre, ~28 % of
// the screen tall when open; the five columns take the space above it, the total sits between the two. Pure:
// screen px, except the columns' area (world px, for the columns' pixel layer).

/** The vault-case sprite's frame (vault-case.json). */
export const VAULT_FRAME = { w: 68, h: 78, frames: 4 } as const;
/** The open chest's height (frame px): its lid's top (row 33) down to the frame's bottom. */
export const OPEN_H = 45;
/** The body's width (frame px). */
export const BODY_W = 40;
/** The body's centre sits this far (frame px) above the frame's bottom; the closed vault's middle. */
export const BODY_UP = 14;

const CHEST_SHARE = 0.28;
const BOTTOM_LANDSCAPE = 0.88;
const BOTTOM_PORTRAIT = 0.8;
/** World px above the columns. */
const TOP_MARGIN = 6;
/** World px between the columns' area and the total, and between the total and the lid. */
const GAP = 2;

export interface VaultLayout {
  /** The key phase: the vault's bottom-centre and scale, the devil key's home, the hint's top. */
  key: { bottom: Pt; S: number; home: Pt; hintY: number };
  /** The open chest: its bottom-centre (x, bottom), the open lid's top, its whole-number scale. */
  chest: { x: number; bottom: number; top: number; S: number };
  /** The five columns and their labels (world px). */
  columnsArea: Rect;
  /** The total's centre, and its font size. */
  totalAt: Pt;
  totalSize: number;
}

/** The columns' strip across the table's width (world px): the HUD and the panels are gone. */
export function vaultReelArea(l: TableLayout): Rect {
  return { x: l.table.x + 8, y: TOP_MARGIN, w: l.table.w - 16, h: l.table.y + 44 - TOP_MARGIN };
}

export function vaultLayout(screen: { w: number; h: number }, l: TableLayout, k: number): VaultLayout {
  const { w, h } = screen;
  const cx = w / 2;

  const Sk = Math.max(1, Math.floor(Math.min((h * 0.5) / OPEN_H, (w * 0.62) / BODY_W)));
  const keyCentreY = Math.round(h * 0.5 + 4.5 * Sk);
  const key = {
    bottom: { x: cx, y: keyCentreY + BODY_UP * Sk },
    S: Sk,
    home: { x: cx - BODY_W * Sk * 0.5 - 16 * Sk * 0.6, y: keyCentreY - 6 * Sk },
    hintY: keyCentreY + 16 * Sk,
  };

  const S = Math.max(1, Math.min(Math.round((h * CHEST_SHARE) / OPEN_H), Math.floor((w * 0.9) / VAULT_FRAME.w)));
  const bottom = Math.round(h * (h > w ? BOTTOM_PORTRAIT : BOTTOM_LANDSCAPE));
  const top = bottom - OPEN_H * S;

  const totalSize = hdFontSize(k, 16);
  const totalY = Math.round(top - GAP * k - totalSize * 0.75);
  const columnsBottom = Math.min(l.worldH, Math.floor((totalY - totalSize * 0.75 - GAP * k) / k));
  const strip = vaultReelArea(l);

  return {
    key,
    chest: { x: cx, bottom, top, S },
    columnsArea: { x: strip.x, y: TOP_MARGIN, w: strip.w, h: columnsBottom - TOP_MARGIN },
    totalAt: { x: cx, y: totalY },
    totalSize,
  };
}
