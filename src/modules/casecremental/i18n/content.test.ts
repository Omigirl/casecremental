import { afterEach, describe, expect, it } from "vitest";
import { CASES } from "../sim/content/cases";
import { VAULTS } from "../sim/content/vaults";
import { UPGRADE_IDS } from "../sim/upgrades";
import { budgetFor, fitsBudget } from "./budgets";
import { RUN1_CHARMS } from "../sim/charms";
import { PERK_IDS } from "../sim/meta";
import {
  CONTENT_KEYS,
  caseName,
  charmDesc,
  charmName,
  perkDesc,
  perkName,
  rarityName,
  skinName,
  stageName,
  upgradeName,
  weaponName,
} from "./content";
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
    expect(stageName(5)).toBe("Unhinged");
    setLang("ru");
    expect(caseName("bootcamp")).toBe("Учебка");
    expect(weaponName("rifle")).toBe("АК-Пиу");
    expect(rarityName("covert")).toBe("Тайное");
    expect(skinName("bc_woodland")).toBe("Лесные учения");
    expect(stageName(2)).toBe("Навеселе");
    expect(stageName(5)).toBe("Без тормозов");
  });

  it("names every Run 1 charm and perk, and the vault, in both languages", () => {
    for (const lang of ["en", "ru"] as const) {
      setLang(lang);
      for (const id of RUN1_CHARMS) {
        expect(charmName(id)).not.toBe("");
        expect(charmDesc(id)).not.toBe("");
      }
      for (const id of PERK_IDS) {
        expect(perkName(id)).not.toBe("");
        expect(perkDesc(id)).not.toBe("");
      }
      expect(caseName("vault1")).not.toBe("");
    }
  });

  it("names every case, vault and skin (vault legends included) in both languages", () => {
    for (const lang of ["en", "ru"] as const) {
      setLang(lang);
      for (const id of [...CASES.map((c) => c.id), "vault1", "vault2", "vault3"]) expect(caseName(id), id).not.toBe("");
      for (const id of [...CASES.flatMap((c) => c.skins.map((s) => s.id)), ...VAULTS.map((v) => v.legend.id)])
        expect(skinName(id), id).not.toBe("");
    }
  });

  it.each(CONTENT_KEYS())("%s fits its budget in both languages", (key, en, ru) => {
    expect(fitsBudget(en, budgetFor(key))).toBe(true);
    expect(fitsBudget(ru, budgetFor(key))).toBe(true);
  });
});
