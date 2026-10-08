import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n/index";
import type { Drop } from "../sim/types";
import { fitCentre, hintKey, revealLines } from "./labels";

afterEach(() => setLang("en"));

const DROP: Drop = {
  id: 1,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.05,
  wear: "FN",
  statTrak: true,
  value: 7.5,
};

describe("canvas labels", () => {
  it("follows a language switch while the card is up", () => {
    expect(revealLines(DROP)).toEqual(["ST™ AK-Pew | Woodland Drill", "Factory New · $7.50"]);
    setLang("ru");
    expect(revealLines(DROP)).toEqual(["ST™ АК-Пиу | Лесные учения", "С завода · $7,50"]);
  });

  it("hints at the next step and stays quiet while the reel spins", () => {
    expect(hintKey({ phase: "empty" })).toBe("hint.buy");
    expect(hintKey({ phase: "spinning", caseId: "bootcamp", drop: DROP, elapsed: 1, fullDuration: 6 })).toBeNull();
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", drop: DROP })).toBe("hint.sell");
  });

  it("keeps a centred line inside its span, as near the wanted centre as it fits", () => {
    expect(fitCentre(100, 40, 0, 300)).toBe(100); // fits where it is
    expect(fitCentre(30, 100, 0, 300)).toBe(50); // pushed off the left edge
    expect(fitCentre(290, 100, 0, 300)).toBe(250); // pushed off the right edge
    expect(fitCentre(30, 400, 0, 300)).toBe(150); // wider than the span: centred on it
  });
});
