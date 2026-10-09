import { describe, expect, it } from "vitest";
import { setLang } from "../../i18n/index";
import { skinName } from "../../i18n/content";
import { CASES, VAULT_LEGEND } from "../../sim/content/cases";
import { hdFontSize } from "../pixel/screen";
import { pixelViewport } from "../pixel/viewport";
import { fitLabel, gridFont, LABEL_MIN_SHARE } from "./fitLabel";
import { vaultLayout } from "./vaultLayout";

// Press Start 2P is monospaced: a line is (characters × font size) px wide.
const words = (s: string) => s.split(" ");

describe("fitLabel (a column's skin name: wrapped at spaces only, shrunk to fit its longest word)", () => {
  it("wraps 'Расплавленная корона' in a 75-px column to two whole words at a smaller size", () => {
    const f = fitLabel(words("Расплавленная корона"), 75, 1, 8, 8 * LABEL_MIN_SHARE);
    expect(f.lines).toEqual(["Расплавленная", "корона"]);
    expect(f.size).toBeLessThan(8);
    expect(13 * f.size).toBeLessThanOrEqual(75);
    expect(f.overflow).toBe(false);
  });

  it("keeps the base size when every word fits, and puts as many words on a line as fit", () => {
    expect(fitLabel(words("Event Horizon"), 120, 1, 8, 4.8)).toEqual({ size: 8, lines: ["Event Horizon"], overflow: false }); // 13 × 8 = 104
    expect(fitLabel(words("Event Horizon"), 64, 1, 8, 4.8)).toEqual({ size: 8, lines: ["Event", "Horizon"], overflow: false }); // 7 × 8 = 56
  });

  it("never breaks inside a word; past the floor it truncates the word with an ellipsis instead of spilling", () => {
    const f = fitLabel(words("Сверхдлинноеслово да"), 40, 1, 8, 4.8);
    expect(f.size).toBe(5); // the floor, on whole px
    expect(f.lines).toEqual(["Сверхдл…", "да"]); // 8 characters of 5 px
    expect(f.overflow).toBe(true);
    for (const line of f.lines) expect([...line].length * f.size).toBeLessThanOrEqual(40);
  });

  it("truncates a one-line name that can't fit at the floor, and leaves one that fits alone", () => {
    const f = fitLabel(["Molten Crown of the Abyss"], 60, 1, 8, 4.8);
    expect(f.lines).toHaveLength(1);
    expect(f.lines[0]!.endsWith("…")).toBe(true);
    expect([...f.lines[0]!].length * f.size).toBeLessThanOrEqual(60);
    expect(f.overflow).toBe(true);
    expect(fitLabel(["+$999.9Qa"], 9 * 8, 1, 8, 4.8)).toEqual({ size: 8, lines: ["+$999.9Qa"], overflow: false });
  });

  it("snaps a shrunk size to Press Start 2P's grid: a multiple of 8 when one fits above the floor, else whole px", () => {
    // 13 characters: 19 px would fit, the grid's 16 is drawn
    expect(fitLabel(["Расплавленная"], 250, 1, 24, 24 * LABEL_MIN_SHARE).size).toBe(16);
    // 12 px fits; no multiple of 8 between the floor (9.6) and 12: whole px
    expect(fitLabel(["Расплавленная"], 160, 1, 16, 16 * LABEL_MIN_SHARE).size).toBe(12);
    // a fractional character width still lands on whole px
    const f = fitLabel(["Event"], 50, 1.5, 8, 4.8);
    expect(Number.isInteger(f.size)).toBe(true);
    expect(5 * 1.5 * f.size).toBeLessThanOrEqual(50);
    for (let w = 20; w <= 400; w += 7)
      for (const base of [8, 16, 24, 32]) {
        const s = fitLabel(["Расплавленная"], w, 1, base, base * LABEL_MIN_SHARE).size;
        expect(Number.isInteger(s), `${w} ${base}: ${s}`).toBe(true);
        // off the 8-grid only when no multiple of 8 lies between the floor and the fit
        if (s > 8 && s % 8 !== 0) expect(Math.floor(s / 8) * 8, `${w} ${base}: ${s}`).toBeLessThan(base * LABEL_MIN_SHARE);
      }
  });

  it("gridFont keeps sizes from 8 up on multiples of 8 and smaller ones on whole px", () => {
    expect(gridFont(16)).toBe(16);
    expect(gridFont(13.6)).toBe(8);
    expect(gridFont(23.9)).toBe(16);
    expect(gridFont(7.4)).toBe(7);
    expect(gridFont(0.4)).toBe(1);
  });

  it("fits every name a vault reward can show on one line of its beam's label box, in both languages, above the floor, on every supported screen", () => {
    const ids = [...CASES[CASES.length - 1]!.skins.map((s) => s.id), VAULT_LEGEND.id];
    for (const screen of [
      { w: 1920, h: 1080 },
      { w: 1324, h: 824 },
      { w: 1324, h: 768 },
      { w: 390, h: 844 },
    ]) {
      const vp = pixelViewport(screen.w, screen.h);
      for (const beam of vaultLayout(screen, vp.scale).beams) {
        const box = beam.label;
        // the renderer's font is a line of the box: full size on these screens, none of them crowded
        const base = box.h / 2;
        expect(base).toBe(hdFontSize(vp.scale));
        for (const lang of ["en", "ru"] as const) {
          setLang(lang);
          for (const id of ids) {
            const f = fitLabel([skinName(id)], box.w, 1, base, base * LABEL_MIN_SHARE);
            expect(f.overflow, `${lang} ${skinName(id)} at ${screen.w}×${screen.h}`).toBe(false);
            expect(f.lines).toHaveLength(1);
            expect([...f.lines[0]!].length * f.size).toBeLessThanOrEqual(box.w);
            expect(f.size + base).toBeLessThanOrEqual(box.h); // the name over its +$
          }
        }
      }
    }
    setLang("en");
  });
});
