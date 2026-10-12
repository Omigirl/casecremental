import { afterEach, describe, expect, it } from "vitest";
import { budgetFor, fitsBudget } from "../i18n/budgets";
import { setLang } from "../i18n/index";
import type { CampaignStats } from "../sim/meta";
import { RARITY_INFO } from "../sim/rarity";
import {
  canSkip,
  CREDITS_SECONDS,
  creditLines,
  creditsOver,
  formatDuration,
  GAME_NAME,
  MADE_BY,
  scrollY,
  SKIP_AFTER_SECONDS,
  TOOLS,
} from "./creditsRules";

afterEach(() => setLang("en"));
const stats: CampaignStats = {
  playSeconds: 3725,
  opened: 12345,
  best: { id: 9, caseId: "feverdream", skinId: "fd_knife", rarity: "gold", float: 0.01, wear: "FN", statTrak: true, value: 4.2e12 },
  cloutEarned: 321,
};

describe("the credits", () => {
  it("credit the game, its maker, its tools, the player, and show the campaign", () => {
    const text = creditLines(stats, "en").map((l) => l.text);
    expect(text[0]).toBe(GAME_NAME);
    expect(text).toContain(MADE_BY);
    expect(MADE_BY).toBe("Yerassyl Omirtay");
    for (const tool of TOOLS) expect(text).toContain(tool);
    expect(TOOLS).toEqual(["iDosGames", "PixiJS", "ElevenLabs", "Claude"]);
    expect(text).toContain("THANK YOU FOR PLAYING");
    expect(text).toContain("Time played: 1h 2m");
    expect(text).toContain("Cases opened: 12,345");
    expect(text).toContain("CLOUT earned: 321");
    expect(text.some((s) => s.includes("Daydream"))).toBe(true);
    expect(creditLines({ ...stats, best: null }, "en").some((l) => l.text.startsWith("Best drop"))).toBe(false);
  });

  it("show the best drop in its rarity's colour", () => {
    const line = creditLines(stats, "en").find((l) => l.text.includes("Daydream"))!;
    expect(line.color).toBe(`#${RARITY_INFO.gold.color.toString(16).padStart(6, "0")}`);
  });

  it("write time in both languages", () => {
    expect(formatDuration(3725)).toBe("1h 2m");
    expect(formatDuration(125)).toBe("2m");
    setLang("ru");
    expect(formatDuration(3725)).toBe("1 ч 2 мин");
    expect(formatDuration(30)).toBe("0 мин");
  });

  it("can be skipped only after 5 s, and end by themselves (Review Focus 4)", () => {
    expect(SKIP_AFTER_SECONDS).toBe(5);
    expect(canSkip(4.99)).toBe(false);
    expect(canSkip(5)).toBe(true);
    expect(creditsOver(CREDITS_SECONDS - 0.01)).toBe(false);
    expect(creditsOver(CREDITS_SECONDS)).toBe(true);
  });

  it("scroll up from below the screen until the last line has left it", () => {
    expect(scrollY(0, 900, 400)).toBe(400);
    expect(scrollY(CREDITS_SECONDS, 900, 400)).toBe(-900);
    expect(scrollY(CREDITS_SECONDS * 2, 900, 400)).toBe(-900);
    for (let e = 1; e <= CREDITS_SECONDS; e++) expect(scrollY(e, 900, 400)).toBeLessThan(scrollY(e - 1, 900, 400));
  });

  it.each(["en", "ru"] as const)("fit their lines (%s)", (lang) => {
    setLang(lang);
    for (const l of creditLines(stats, lang))
      if (l.kind === "head" || l.kind === "stat") expect(fitsBudget(l.text, budgetFor("credits.x")), l.text).toBe(true);
  });
});
