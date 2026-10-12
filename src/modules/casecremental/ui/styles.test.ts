import { describe, expect, it } from "vitest";
import { UI_CSS } from "./styles";

// The overlay's stylesheet holds two F1 fixes: the panels never flash a scrollbar, and the game's text is not selectable.

const rule = (selector: string): string => {
  const at = UI_CSS.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return UI_CSS.slice(at, UI_CSS.indexOf("}", at));
};

describe("the overlay's stylesheet", () => {
  it("never lets a panel's scroll area flash a scrollbar (F1 #1, Review Focus 1)", () => {
    const s = rule(".cc-scroll");
    expect(s).toContain("overflow-y: auto");
    expect(s).toContain("overflow-x: hidden");
    expect(s).toContain("scrollbar-gutter: stable both-edges");
    expect(s).toContain("padding-block: calc(var(--px) * 2px)"); // room for a pressed button's 1-px dip in the last row
  });

  it("turns text selection and the iOS callout off on the game root, and back on for real inputs (F1 #2)", () => {
    const root = rule(".cc-root");
    for (const p of ["user-select: none", "-webkit-user-select: none", "-webkit-touch-callout: none"]) expect(root).toContain(p);
    const inputs = rule('.cc-root input, .cc-root textarea, .cc-root select, .cc-root [contenteditable="true"]');
    expect(inputs).toContain("user-select: text");
    expect(inputs).toContain("-webkit-user-select: text");
    expect(inputs).toContain("-webkit-touch-callout: default");
  });
});
