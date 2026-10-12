import { PANEL_CHROME } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";

// How the case shelf's rows fit (Press Start 2P is monospaced: a character is the font size wide). The panels are at
// least 64 world px wide (fx/pixel/layout.ts); these numbers keep seven cases' names and the vault's on two lines
// beside their icons, in both languages (spec §3: names up to 12 characters, the vault's up to 14).

/** A shelf icon's CSS px per sprite px. */
export const shelfIconK = (scale: number): number => Math.max(1, Math.floor(scale / 3));

/** World px a row's text loses across a panel: the frame (6 + 6), the panel padding (1 + 1), the row padding (1 + 1). */
export const ROW_TEXT_CHROME = PANEL_CHROME - 2;
/** A skinned button's chrome in world px (`.cc-btn.skinned` in ui/styles.ts: a 4 px border + 1 px padding per side). */
export const BTN_CHROME = 10;
/** `.cc-row-line`'s gap (ui/styles.ts): 2 world px. */
export const ROW_GAP = 2;

/** Characters that fit beside an icon `iconW` sprite px wide, in a panel `panelW` world px wide at pixel scale `scale`. */
export function charsBesideIcon(panelW: number, scale: number, iconW: number): number {
  const charW = hdFontSize(scale) / scale;
  return Math.floor((panelW - ROW_TEXT_CHROME - (iconW * shelfIconK(scale)) / scale - ROW_GAP) / charW);
}

/** How `text` wraps into lines of `perLine` characters, breaking at spaces and after hyphens (as the browser does);
 *  `spills` when one piece is longer than a line. */
export function wrapLines(text: string, perLine: number): { lines: number; spills: boolean } {
  const pieces: Array<{ text: string; space: boolean }> = [];
  text.split(" ").forEach((word, wi) => word.split(/(?<=-)/).forEach((part, pi) => pieces.push({ text: part, space: wi > 0 && pi === 0 })));
  let lines = 1;
  let used = 0;
  let spills = false;
  for (const p of pieces) {
    const need = (used > 0 && p.space ? 1 : 0) + p.text.length;
    if (used > 0 && used + need > perLine) {
      lines++;
      used = p.text.length;
    } else used += need;
    if (p.text.length > perLine) spills = true;
  }
  return { lines, spills };
}
