import { afterEach, describe, expect, it } from "vitest";
import { budgetFor, fitsBudget } from "./budgets";
import { EN } from "./en";
import { detectLang, getLang, onLangChange, setLang, t } from "./index";
import { RU } from "./ru";

afterEach(() => setLang("en"));

describe("language state", () => {
  it("detects Russian from browser languages, else English", () => {
    expect(detectLang(["ru-RU", "en"])).toBe("ru");
    expect(detectLang(["en-US", "ru"])).toBe("en");
    expect(detectLang(["kk"])).toBe("en");
    expect(detectLang([])).toBe("en");
  });

  it("switches language and notifies listeners once per change", () => {
    let calls = 0;
    const off = onLangChange(() => calls++);
    setLang("ru"); setLang("ru"); setLang("en");
    off(); setLang("ru");
    expect(calls).toBe(2);
    expect(getLang()).toBe("ru");
  });

  it("translates and substitutes variables in the current language", () => {
    expect(t("hud.combo", { mult: "1.40" })).toBe("COMBO x1.40");
    setLang("ru");
    expect(t("hud.combo", { mult: "1,40" })).toBe("КОМБО x1,40");
  });
});

describe("string tables", () => {
  it("Russian has exactly the English keys", () => {
    expect(Object.keys(RU).sort()).toEqual(Object.keys(EN).sort());
  });

  it.each(Object.keys(EN))("%s fits its character budget in both languages", (key) => {
    const b = budgetFor(key);
    const strip = (s: string) => s.replace(/\{\w+\}/g, "");
    expect(fitsBudget(strip(EN[key as keyof typeof EN]), b)).toBe(true);
    expect(fitsBudget(strip(RU[key as keyof typeof EN]), b)).toBe(true);
  });
});
