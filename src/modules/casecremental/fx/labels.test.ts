import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n/index";
import type { Drop } from "../sim/types";
import { hintKey, revealLines } from "./labels";

afterEach(() => setLang("en"));

const DROP: Drop = { id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec", float: 0.05, wear: "FN", statTrak: true, value: 7.5 };

describe("canvas labels", () => {
  it("follows a language switch while the card is up", () => {
    expect(revealLines(DROP)).toEqual(["ST™ AK-Pew | Woodland Drill", "Factory New · $7.50"]);
    setLang("ru");
    expect(revealLines(DROP)).toEqual(["ST™ АК-Пиу | Лесные учения", "С завода · $7,50"]);
  });

  it("hints at the next step, and hides the brake hint when braking isn't possible", () => {
    expect(hintKey({ phase: "empty" }, false)).toBe("hint.buy");
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", drop: DROP }, false)).toBe("hint.sell");
  });
});
