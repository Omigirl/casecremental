import { afterEach, describe, expect, it } from "vitest";
import { budgetFor, fitsBudget } from "./budgets";
import { EN } from "./en";
import { detectLang, getLang, onLangChange, setLang, t } from "./index";
import { RU } from "./ru";
import { CASES } from "../sim/content/cases";
import { caseName, cardFill } from "./content";
import { AUTOSPIN_DELAYS } from "../sim/tuning";
import { delaySeconds } from "../ui/autoSpinRules";
import { wrapLines } from "../ui/shelfFit";

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
    setLang("ru");
    setLang("ru");
    setLang("en");
    off();
    setLang("ru");
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

describe("M3 strings with their values filled in", () => {
  const fits = (key: keyof typeof EN, vars: Record<string, string | number>) => fitsBudget(t(key, vars), budgetFor(key));

  it.each(["en", "ru"] as const)("the run lines fit with every run number and cap (%s)", (lang) => {
    setLang(lang);
    for (const n of [1, 2, 3])
      for (const key of ["hud.run", "prestige.nextrun", "prestige.again"] as const) expect(fits(key, { n }), `${key} ${n}`).toBe(true);
    for (const n of [3, 5, 20, 50])
      for (const key of ["brings.multiOpen", "brings.botSpeed"] as const) expect(fits(key, { n }), `${key} ${n}`).toBe(true);
    expect(fits("locker.count", { n: 50, max: 50 })).toBe(true);
    for (const s of AUTOSPIN_DELAYS) expect(fits("autospin.delay", { s: delaySeconds(s, lang) }), `delay ${s}`).toBe(true);
    for (const n of [9, 12]) expect(fits("locker.size", { n }), "locker.size").toBe(true);
  });

  it.each(["en", "ru"] as const)("every case fits the prestige screen's new-case line (%s)", (lang) => {
    setLang(lang);
    for (const c of CASES) expect(fits("brings.case", { name: caseName(c.id) }), c.id).toBe(true);
  });
});

describe("F3 strings", () => {
  const fits = (key: keyof typeof EN, vars: Record<string, string | number>) => fitsBudget(t(key, vars), budgetFor(key));
  const BUBBLE_KEYS = [
    "tut.buy",
    "tut.key",
    "tut.sell",
    "tut.upgrades",
    "tut.unlock",
    "tut.bot",
    "tut.seller",
    "tut.autospin",
    "tut.vault",
  ] as const;

  it.each(["en", "ru"] as const)("every bubble wraps into at most 3 lines of 24 characters (%s)", (lang) => {
    setLang(lang);
    for (const key of BUBBLE_KEYS) {
      const w = wrapLines(t(key), 24);
      expect(w.lines, key).toBeLessThanOrEqual(3);
      expect(w.spills, key).toBe(false);
    }
  });

  it.each(["en", "ru"] as const)("the new-run card's title fits for Runs 2, 3 and 4 (%s)", (lang) => {
    setLang(lang);
    for (const n of [2, 3, 4]) expect(fits("card.title", { n }), `run ${n}`).toBe(true);
  });

  it.each(["en", "ru"] as const)("Run 4's card names cases 8 and 9 as the shelf does, and fits filled in (%s)", (lang) => {
    setLang(lang);
    const text = t("card.run4", cardFill());
    expect(text).toContain(caseName("glitch"));
    expect(text).toContain(caseName("feverdream"));
    expect(text).toContain(caseName("lastcase"));
    expect(fits("card.run4", cardFill())).toBe(true);
  });
});
