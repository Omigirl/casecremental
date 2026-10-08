import { describe, expect, it } from "vitest";
import { HUMAN, playGreedy } from "./bot";
import { buyPerk, completeVault, freshMeta, PERK_IDS, perkCost, setupFor } from "./meta";

// Spec §9.6 targets for milestone 1's slice (cases 1–3). Median of five seeds so one lucky knife
// doesn't decide the result. When this fails, tune sim/tuning.ts — never the bot or the logic.

const SEEDS = [1, 2, 3, 4, 5];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe("pacing (greedy bot, human-speed actions)", () => {
  const reports = SEEDS.map((s) => playGreedy(s, 600));
  const at = (pick: (r: (typeof reports)[number]) => number | undefined) => median(reports.map((r) => pick(r) ?? Number.POSITIVE_INFINITY));

  it("unlocks Wildwood in about 1–2.5 minutes", () => {
    const t = at((r) => r.caseUnlockedAt.wildwood);
    expect(t).toBeGreaterThan(45);
    expect(t).toBeLessThan(150);
  });

  it("unlocks Bedrock in about 2.5–6.5 minutes", () => {
    const t = at((r) => r.caseUnlockedAt.bedrock);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(400);
  });

  it("reaches stage 2 (Buzzed) within 20 s – 2 min", () => {
    const t = at((r) => r.stageReachedAt[2]);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(120);
  });
});

describe("pacing — the whole of Run 1 and a boosted second run", () => {
  const first = SEEDS.map((s) => playGreedy(s, 900));
  const med = (pick: (r: (typeof first)[number]) => number | undefined, rs = first) =>
    median(rs.map((r) => pick(r) ?? Number.POSITIVE_INFINITY));

  it("wakes the bot by about two and a half minutes", () => {
    expect(med((r) => r.botAwakeAt)).toBeLessThan(150);
  });

  it("buys the auto-seller at about 3–5 minutes", () => {
    const t = med((r) => r.sellerAt);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(330);
  });

  it("buys Vault Case I at 6–10 minutes", () => {
    const t = med((r) => r.vaultAt);
    expect(t).toBeGreaterThan(360);
    expect(t).toBeLessThan(600);
  });

  it("never leaves the tray stuck full for long", () => {
    for (const r of first) expect(r.longestTrayFull).toBeLessThan(10);
  });

  it("a boosted second run (one vault, cheapest perk) catches up in 1–2 min and vaults again by 5–7 min", () => {
    const second = SEEDS.map((s, i) => {
      const meta = freshMeta();
      completeVault(meta, first[i]!.lifetimeEarnings, "vault1", s);
      const cheapest = [...PERK_IDS].sort((a, b) => (perkCost(a, 0) ?? Infinity) - (perkCost(b, 0) ?? Infinity))[0]!;
      buyPerk(meta, cheapest);
      return playGreedy(s + 100, 900, HUMAN, setupFor(meta));
    });
    const caughtUp = med((r) => r.allUnlockedAt, second);
    expect(caughtUp).toBeGreaterThan(60);
    expect(caughtUp).toBeLessThan(120);
    const again = med((r) => r.vaultAt, second);
    expect(again).toBeGreaterThan(300);
    expect(again).toBeLessThan(420);
  });
});
