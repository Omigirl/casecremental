// No text selection and no iOS long-press callout anywhere in the game (F1): the canvas and the UI overlay both opt
// out. Real text inputs opt back in (ui/styles.ts).

/** The CSS that turns selection off, as [property, value] pairs (the stylesheet and the canvas share it). */
export const NO_SELECT: ReadonlyArray<readonly [string, string]> = [
  ["user-select", "none"],
  ["-webkit-user-select", "none"],
  ["-webkit-touch-callout", "none"],
];

/** Turn selection off on an element (the Pixi canvas); a no-op for one without a style. */
export function blockSelection(el: { style?: unknown }): void {
  const style = el.style as { setProperty?: (name: string, value: string) => void } | undefined;
  for (const [k, v] of NO_SELECT) style?.setProperty?.(k, v);
}
