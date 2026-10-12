import { afterEach, describe, expect, it } from "vitest";
import { tableLayout } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";
import { spriteIndex } from "../fx/pixel/sprites";
import { pixelViewport } from "../fx/pixel/viewport";
import { caseName } from "../i18n/content";
import { setLang } from "../i18n/index";
import { CASES } from "../sim/content/cases";
import { charsBesideIcon, ROW_GAP, ROW_TEXT_CHROME, wrapLines } from "./shelfFit";

afterEach(() => setLang("en"));

// The landscape sizes of fx/pixel/layout.test.ts (portrait has no side panel: the drawer is the screen's width).
const SIZES: Array<[number, number]> = [
  [1024, 768],
  [1280, 1024],
  [2732, 2048],
  [1000, 1000],
  [1312, 1080],
  [900, 860],
  [1920, 1080],
  [1280, 720],
  [3440, 1440],
  [800, 450],
  [1366, 768],
  [1084, 749],
  [1159, 777],
  [1440, 900],
  [2560, 1440],
];
const ICON_W = Math.max(27, ...[...spriteIndex().entries()].filter(([id]) => id.startsWith("case-")).map(([, e]) => e.meta.frameW));
const NAMES = [...CASES.map((c) => c.id), "vault1", "vault2", "vault3"];

describe("wrapLines", () => {
  it("wraps at spaces and after hyphens, and knows a word that is too long", () => {
    expect(wrapLines("Vault Case III", 9)).toEqual({ lines: 2, spills: false });
    expect(wrapLines("Сейф-кейс III", 9)).toEqual({ lines: 2, spills: false });
    expect(wrapLines("Mainframe", 8)).toEqual({ lines: 1, spills: true });
    expect(wrapLines("Boot Camp", 12)).toEqual({ lines: 1, spills: false });
  });
});

describe.each(SIZES)("the case shelf at %i×%i (Review Focus 4)", (w, h) => {
  const vp = pixelViewport(w, h);
  const l = tableLayout(vp);
  const panelW = l.panelR!.w;

  it.each(["en", "ru"] as const)("fits every case's and vault's name beside its icon in two lines (%s)", (lang) => {
    setLang(lang);
    const per = charsBesideIcon(panelW, vp.scale, ICON_W);
    for (const id of NAMES) {
      const fit = wrapLines(caseName(id), per);
      expect(fit.spills, `${caseName(id)} in ${per}`).toBe(false);
      expect(fit.lines, caseName(id)).toBeLessThanOrEqual(2);
    }
  });

  it("fits the widest BUY (×5) and the tick box on one line", () => {
    const charW = hdFontSize(vp.scale) / vp.scale;
    const button = "КУПИТЬ ×5".length * charW + 2; // its text and its padding (1 + 1)
    const tick = (7 / 8) * charW + 2;
    expect(button + ROW_GAP + tick).toBeLessThanOrEqual(panelW - ROW_TEXT_CHROME);
  });
});
