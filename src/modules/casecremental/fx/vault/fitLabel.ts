// A vault reward's skin name or +$ (Press Start 2P is monospaced: a line is characters × size px wide). It wraps
// at spaces only, never inside a word; when its longest word is wider than the box, the label's font shrinks
// until it fits, down to a floor, on the font's grid (gridFont). Past the floor a word is cut short with "…", so
// nothing spills out of the box. Passed the whole name as one word, it keeps the name on one line.

/** The floor, as a share of the base size. */
export const LABEL_MIN_SHARE = 0.6;
const ELLIPSIS = "…";

export interface FittedLabel {
  size: number;
  lines: string[];
  /** A word was wider than `maxWidth` at the floor: it was cut short with "…". */
  overflow: boolean;
}

const chars = (s: string): number => [...s].length;

/** Press Start 2P's grid: a size of 8 px or more drops to a multiple of 8 (its pixels stay whole), a smaller one
 *  to whole px (at least 1). */
export const gridFont = (size: number): number => (size >= 8 ? 8 * Math.floor(size / 8) : Math.max(1, Math.floor(size)));

/** The largest size ≤ `fit` on the grid: a multiple of 8 when one lies at or above the floor, else whole px —
 *  never under the floor (rounded up to whole px). */
function snap(fit: number, minSize: number): number {
  const floor = Math.ceil(minSize);
  const grid = gridFont(fit);
  if (grid >= floor) return grid;
  return Math.max(floor, Math.floor(fit));
}

export function fitLabel(words: readonly string[], maxWidth: number, charWidth: number, baseSize: number, minSize: number): FittedLabel {
  const longest = Math.max(1, ...words.map(chars));
  const size = snap(Math.min(baseSize, maxWidth / (longest * charWidth)), minSize);
  const perLine = Math.max(1, Math.floor(maxWidth / (charWidth * size)));
  const lines: string[] = [];
  for (const w of words.filter((x) => x.length)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && chars(last) + 1 + chars(w) <= perLine) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const overflow = longest * charWidth * size > maxWidth;
  const cut = (line: string) => (chars(line) <= perLine ? line : [...line].slice(0, perLine - 1).join("") + ELLIPSIS);
  return { size, lines: overflow ? lines.map(cut) : lines, overflow };
}
