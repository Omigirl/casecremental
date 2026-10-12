import { afterEach, describe, expect, it } from "vitest";
import { tableLayout } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";
import { spriteIndex } from "../fx/pixel/sprites";
import { pixelViewport } from "../fx/pixel/viewport";
import { caseName } from "../i18n/content";
import { setLang, t } from "../i18n/index";
import { CASES } from "../sim/content/cases";
import { BTN_CHROME, charsBesideIcon, picksShown, ROW_TEXT_CHROME, wrapLines } from "./shelfFit";

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

  it.each(["en", "ru"] as const)("fits the widest BUY (×5) on its own line, skinned button (%s)", (lang) => {
    setLang(lang);
    const charW = hdFontSize(vp.scale) / vp.scale;
    const button = `${t("btn.buy")} ×5`.length * charW + BTN_CHROME;
    expect(button).toBeLessThanOrEqual(panelW - ROW_TEXT_CHROME);
  });
});

describe("picksShown", () => {
  it("shows the shelf's pick boxes once auto-spin is bought", () => {
    expect(picksShown({ autoSpin: { owned: false } })).toBe(false);
    expect(picksShown({ autoSpin: { owned: true } })).toBe(true);
  });
});
