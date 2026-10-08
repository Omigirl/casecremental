import { afterEach, describe, expect, it } from "vitest";
import { CASES } from "../sim/content/cases";
import { UPGRADE_IDS } from "../sim/upgrades";
import { budgetFor, fitsBudget } from "./budgets";
import { CONTENT_KEYS, caseName, rarityName, skinName, stageName, upgradeName, weaponName } from "./content";
import { setLang } from "./index";

afterEach(() => setLang("en"));

describe("content names", () => {
  it("names every case, skin and upgrade in both languages", () => {
    for (const c of CASES) {
      expect(caseName(c.id)).not.toBe("");
      for (const s of c.skins) expect(skinName(s.id)).not.toBe("");
    }
    for (const id of UPGRADE_IDS) expect(upgradeName(id)).not.toBe("");
  });

  it("follows the current language", () => {
    expect(caseName("bootcamp")).toBe("Boot Camp");
    expect(weaponName("rifle")).toBe("AK-Pew");
    expect(rarityName("covert")).toBe("Covert");
    expect(stageName(2)).toBe("Buzzed");
    setLang("ru");
    expect(caseName("bootcamp")).toBe("Учебка");
    expect(weaponName("rifle")).toBe("АК-Пиу");
    expect(rarityName("covert")).toBe("Тайное");
    expect(skinName("bc_woodland")).toBe("Лесные учения");
    expect(stageName(2)).toBe("Навеселе");
  });

  it.each(CONTENT_KEYS())("%s fits its budget in both languages", (key, en, ru) => {
    expect(fitsBudget(en, budgetFor(key))).toBe(true);
    expect(fitsBudget(ru, budgetFor(key))).toBe(true);
  });
});
