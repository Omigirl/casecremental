import { describe, expect, it } from "vitest";
import { setLang } from "../../i18n/index";
import { skinName } from "../../i18n/content";
import { CASES, VAULT_LEGEND } from "../../sim/content/cases";
import { hdFontSize } from "../pixel/screen";
import { pixelViewport } from "../pixel/viewport";
import { fitLabel, LABEL_MIN_SHARE } from "./fitLabel";
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

  it("never breaks inside a word; past the floor it overflows (centred by the caller)", () => {
    const f = fitLabel(words("Сверхдлинноеслово да"), 40, 1, 8, 4.8);
    expect(f.size).toBe(4.8);
    expect(f.lines).toEqual(["Сверхдлинноеслово", "да"]);
    expect(f.overflow).toBe(true);
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
      const base = hdFontSize(vp.scale);
      for (const beam of vaultLayout(screen, vp.scale).beams) {
        const box = beam.label;
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
