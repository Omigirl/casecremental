import { afterEach, describe, expect, it } from "vitest";
import { BLACKOUT_SECONDS } from "../fx/vault/lights";
import type { PrestigeView } from "../game/view";
import { budgetFor, fitsBudget } from "../i18n/budgets";
import { setLang, t } from "../i18n/index";
import { VAULTS } from "../sim/content/vaults";
import { bringText, charmChoices, PRESTIGE_DELAY_MS, prestigeDelayMs, runBrings, vaultNumeral } from "./prestigeRules";

const view = (over: Partial<PrestigeView>): PrestigeView => ({
  clout: 10,
  gained: 10,
  loops: 1,
  perks: [],
  offer: ["insider", "ricochet", "goldRush"],
  picked: [],
  slots: 1,
  ...over,
});

describe("the prestige screen", () => {
  it("names the vault that just opened, in both languages", () => {
    expect(VAULTS.map((v) => vaultNumeral(v.id))).toEqual(["I", "II", "III"]);
    try {
      setLang("en");
      expect(t("prestige.title", { n: vaultNumeral("vault1") })).toBe("VAULT I OPENED");
      expect(t("prestige.title", { n: vaultNumeral("vault3") })).toBe("VAULT III OPENED");
      expect(t("prestige.trophy", { n: vaultNumeral("vault2") })).toBe("★ Vault II trophy");
      setLang("ru");
      expect(t("prestige.title", { n: vaultNumeral("vault2") })).toBe("СЕЙФ II ВСКРЫТ");
      expect(t("prestige.trophy", { n: vaultNumeral("vault3") })).toBe("★ Трофей «Сейф III»");
    } finally {
      setLang("en");
    }
  });

  it("lets you pick charms up to your slots, and un-pick a picked one", () => {
    expect(charmChoices(view({})).every((c) => c.enabled && !c.picked)).toBe(true);
    const one = charmChoices(view({ picked: ["ricochet"] }));
    expect(one.find((c) => c.id === "ricochet")).toEqual({ id: "ricochet", picked: true, enabled: true });
    expect(one.filter((c) => !c.picked).every((c) => !c.enabled)).toBe(true);
    expect(charmChoices(view({ picked: ["ricochet"], slots: 2 })).every((c) => c.enabled)).toBe(true);
  });

  it("waits for the blackout only when you watched the run end; after a reload it shows at once (Review Focus 1)", () => {
    expect(prestigeDelayMs(true)).toBe(PRESTIGE_DELAY_MS);
    expect(prestigeDelayMs(false)).toBe(0);
    expect(PRESTIGE_DELAY_MS).toBeGreaterThanOrEqual(BLACKOUT_SECONDS * 1000); // the blackout plays first
    expect(PRESTIGE_DELAY_MS).toBeLessThanOrEqual(BLACKOUT_SECONDS * 1000 + 500); // ...and the screen comes up right after it
  });
});

describe("what the next run brings (spec §8)", () => {
  afterEach(() => setLang("en"));

  it("Run 2: Mainframe and Neon Nights, the bot's x2, the locker, multi-open to x3, bot speed to x20", () => {
    expect(runBrings(2)).toEqual([
      { kind: "case", caseId: "mainframe" },
      { kind: "case", caseId: "neon" },
      { kind: "machine", id: "botMulti" },
      { kind: "machine", id: "locker" },
      { kind: "cap", id: "multiOpen", value: 3 },
      { kind: "cap", id: "botSpeed", value: 20 },
    ]);
  });

  it("Run 3: Deep Space and Inferno, the grid, the auto contract, multi-open to x5, bot speed to x50", () => {
    expect(runBrings(3)).toEqual([
      { kind: "case", caseId: "deepspace" },
      { kind: "case", caseId: "inferno" },
      { kind: "machine", id: "grid" },
      { kind: "machine", id: "autoContract" },
      { kind: "cap", id: "multiOpen", value: 5 },
      { kind: "cap", id: "botSpeed", value: 50 },
    ]);
  });

  it("Run 1 brings nothing new", () => {
    expect(runBrings(1)).toEqual([]);
  });

  it.each(["en", "ru"] as const)("every line fits the prestige screen (%s)", (lang) => {
    setLang(lang);
    for (const b of [...runBrings(2), ...runBrings(3)]) expect(fitsBudget(bringText(b), budgetFor("brings.case")), bringText(b)).toBe(true);
  });
});
