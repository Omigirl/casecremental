import { describe, expect, it } from "vitest";
import { UI_CSS } from "./styles";
import { BUBBLE_CHARS } from "./tutorialPlace";

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
  it("gives the tutorial a bubble that lets drags through and an arrow that only moves (F3, photosensitivity)", () => {
    const bubble = rule(".cc-tut");
    expect(bubble).toContain("pointer-events: none");
    expect(bubble).toContain(`${BUBBLE_CHARS}em`);
    expect(rule(".cc-tut .cc-btn")).toContain("pointer-events: auto");
    const arrow = rule(".cc-tut-arrow");
    expect(arrow).not.toContain("opacity");
    expect(arrow).toContain("animation: cc-tut-bob");
    const bob = UI_CSS.slice(UI_CSS.indexOf("@keyframes cc-tut-bob"), UI_CSS.indexOf("@media (prefers-reduced-motion"));
    expect(bob).toContain("translate:");
    expect(bob).not.toMatch(/opacity|filter|background|color/);
    expect(UI_CSS).toContain("@media (prefers-reduced-motion: reduce) { .cc-tut-arrow { animation: none; } }");
  });

  it("gives a burning combo meter flames that flicker by less than 0.1 (Hot Hand, photosensitivity)", () => {
    expect(rule(".cc-hot::after")).toContain("animation: cc-flame");
    const at = UI_CSS.indexOf("@keyframes cc-flame");
    expect(at).toBeGreaterThanOrEqual(0);
    const frames = UI_CSS.slice(at, UI_CSS.indexOf("\n", at));
    const opacities = [...frames.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(opacities.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...opacities) - Math.min(...opacities)).toBeLessThan(0.1);
    expect(frames).not.toMatch(/filter|background|color/);
    expect(UI_CSS).toContain(".cc-hot::after { animation: none; }");
  });
});
