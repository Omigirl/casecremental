import { afterEach, describe, expect, it } from "vitest";
import { BLACKOUT_SECONDS } from "../fx/vault/lights";
import type { PrestigeView } from "../game/view";
import { budgetFor, fitsBudget } from "../i18n/budgets";
import { setLang, t } from "../i18n/index";
import {
  bringText,
  charmChoices,
  endScreen,
  PRESTIGE_DELAY_MS,
  prestigeDelayMs,
  prestigeTitle,
  runBrings,
  trophyLine,
} from "./prestigeRules";

const view = (over: Partial<PrestigeView>): PrestigeView => ({
  clout: 10,
  gained: 10,
  loops: 1,
  nextRun: 2,
  replay: false,
  perks: [],
  offer: ["insider", "ricochet", "goldRush"],
  picked: [],
  slots: 1,
  credits: false,
  stats: { playSeconds: 0, opened: 0, best: null, cloutEarned: 0 },
  ...over,
});

describe("the prestige screen", () => {
  it("names the vault that just opened, and The Last Case, in both languages", () => {
    try {
      setLang("en");
      expect(prestigeTitle("vault1")).toBe("VAULT I OPENED");
      expect(prestigeTitle("vault3")).toBe("VAULT III OPENED");
      expect(trophyLine("vault2")).toBe("★ Vault II trophy");
      expect(prestigeTitle("lastcase")).toBe("THE LAST CASE OPENED");
      expect(trophyLine("lastcase")).toBe("★ Singularity trophy");
      expect(t("prestige.end")).toBe("THE END");
      expect(t("prestige.again", { n: 4 })).toBe("RUN 4 AGAIN, BOOSTED");
      setLang("ru");
      expect(prestigeTitle("vault2")).toBe("СЕЙФ II ВСКРЫТ");
      expect(trophyLine("vault3")).toBe("★ Трофей «Сейф III»");
      expect(prestigeTitle("lastcase")).toBe("ПОСЛЕДНИЙ КЕЙС ВСКРЫТ");
      expect(trophyLine("lastcase")).toBe("★ Трофей «Сингулярность»");
      expect(t("prestige.end")).toBe("КОНЕЦ");
      expect(t("prestige.again", { n: 4 })).toBe("СНОВА ЗАБЕГ 4, СИЛЬНЕЕ");
    } finally {
      setLang("en");
    }
  });

  it("shows the credits while they roll, then the prestige screen (Review Focus 1)", () => {
    expect(endScreen(null)).toBeNull();
    expect(endScreen(view({ credits: true }))).toBe("credits");
    expect(endScreen(view({ credits: false }))).toBe("prestige");
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

  it("Run 2: Mainframe and Neon Nights, the locker, multi-open to x3, bot speed to x20, the bot opens x2", () => {
    expect(runBrings(2)).toEqual([
      { kind: "case", caseId: "mainframe" },
      { kind: "case", caseId: "neon" },
      { kind: "machine", id: "locker" },
      { kind: "cap", id: "multiOpen", value: 3 },
      { kind: "cap", id: "botSpeed", value: 20 },
      { kind: "cap", id: "botMulti", value: 2 },
    ]);
  });

  it("Run 3: Deep Space and Inferno, the auto contract, multi-open to x5, bot speed to x50", () => {
    expect(runBrings(3)).toEqual([
      { kind: "case", caseId: "deepspace" },
      { kind: "case", caseId: "inferno" },
      { kind: "machine", id: "autoContract" },
      { kind: "cap", id: "multiOpen", value: 5 },
      { kind: "cap", id: "botSpeed", value: 50 },
    ]);
  });

  it("Run 4: Glitch and Fever Dream, the Upgrader, evolutions, bot speed to x100, the bot opens x3", () => {
    expect(runBrings(4)).toEqual([
      { kind: "case", caseId: "glitch" },
      { kind: "case", caseId: "feverdream" },
      { kind: "machine", id: "upgrader" },
      { kind: "machine", id: "evolutions" },
      { kind: "cap", id: "botSpeed", value: 100 },
      { kind: "cap", id: "botMulti", value: 3 },
    ]);
  });

  it("Run 1 brings nothing new", () => {
    expect(runBrings(1)).toEqual([]);
  });

  it.each(["en", "ru"] as const)("every line fits the prestige screen (%s)", (lang) => {
    setLang(lang);
    for (const b of [...runBrings(2), ...runBrings(3), ...runBrings(4)])
      expect(fitsBudget(bringText(b), budgetFor("brings.case")), bringText(b)).toBe(true);
  });
});
