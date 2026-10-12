import { afterEach, describe, expect, it } from "vitest";
import { budgetFor, fitsBudget } from "../i18n/budgets";
import { evolutionDesc, evolutionName } from "../i18n/content";
import { setLang } from "../i18n/index";
import { EVOLUTION_IDS } from "../sim/evolved";
import { RECIPES } from "../sim/evolutions";
import { nextStake, nextTarget, partText, percent } from "./run4Rules";

afterEach(() => setLang("en"));

describe("the Upgrader's rows", () => {
  it("cycles the stake through the rarities the locker holds, then none", () => {
    expect(nextStake(["milspec", "covert"], null)).toBe("milspec");
    expect(nextStake(["milspec", "covert"], "milspec")).toBe("covert");
    expect(nextStake(["milspec", "covert"], "covert")).toBeNull();
    expect(nextStake(["milspec", "covert"], "restricted")).toBe("covert"); // a stake that emptied moves on up
    expect(nextStake([], "gold")).toBeNull();
  });

  it("cycles the six targets and prints chances to two significant digits", () => {
    expect([0, 1, 2, 3, 4, 5].map(nextTarget)).toEqual([1, 2, 3, 4, 5, 0]);
    expect([0.6, 0.45, 0.18, 0.109, 0.009, 0.95].map(percent)).toEqual(["60", "45", "18", "11", "0.9", "95"]);
  });
});

describe("the evolutions' rows", () => {
  it("writes each recipe line", () => {
    expect(partText({ kind: "upgrade", id: "quickHands" }, null)).toBe("Quick Hands MAX");
    expect(partText({ kind: "botSpeed" }, null)).toBe("Bot Speed MAX");
    expect(partText({ kind: "combo", n: 50 }, 31)).toBe("Hand combo 31/50");
    setLang("ru");
    expect(partText({ kind: "combo", n: 50 }, 31)).toBe("Комбо руками 31/50");
  });

  it.each(["en", "ru"] as const)("fits every name, effect and recipe line (%s)", (lang) => {
    setLang(lang);
    for (const id of EVOLUTION_IDS) {
      expect(fitsBudget(evolutionName(id), budgetFor("evo.name.x")), evolutionName(id)).toBe(true);
      expect(fitsBudget(evolutionDesc(id), budgetFor("evo.desc.x")), evolutionDesc(id)).toBe(true);
      for (const p of RECIPES[id]) expect(fitsBudget(partText(p, 50), budgetFor("evo.part.x")), partText(p, 50)).toBe(true);
    }
  });

  it("never needs a Russian word longer than a panel line", () => {
    setLang("ru");
    for (const id of EVOLUTION_IDS)
      for (const w of [evolutionName(id), evolutionDesc(id)].join(" ").split(/\s+/)) expect([...w].length, w).toBeLessThanOrEqual(11);
  });
});
