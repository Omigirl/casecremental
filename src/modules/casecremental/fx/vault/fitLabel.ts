// A vault reward's skin name (Press Start 2P is monospaced: a line is characters × size px wide). It wraps at
// spaces only, never inside a word; when its longest word is wider than the box, the label's font shrinks until
// it fits, down to a floor. Only past the floor does a word overflow (the caller keeps it centred). Passed the
// whole name as one word, it keeps the name on one line and shrinks it to fit.

/** The floor, as a share of the base size. */
export const LABEL_MIN_SHARE = 0.6;

export interface FittedLabel {
  size: number;
  lines: string[];
  /** A word is still wider than `maxWidth` at the floor. */
  overflow: boolean;
}

const chars = (s: string): number => [...s].length;

export function fitLabel(words: readonly string[], maxWidth: number, charWidth: number, baseSize: number, minSize: number): FittedLabel {
  const longest = Math.max(1, ...words.map(chars));
  const size = Math.max(minSize, Math.min(baseSize, Math.floor(maxWidth / (longest * charWidth))));
  const perLine = Math.max(1, Math.floor(maxWidth / (charWidth * size)));
  const lines: string[] = [];
  for (const w of words.filter((x) => x.length)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && chars(last) + 1 + chars(w) <= perLine) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return { size, lines, overflow: longest * charWidth * size > maxWidth };
}
