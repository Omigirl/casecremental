import { describe, expect, it } from "vitest";
import { HUMAN, playGreedy, type PacingReport } from "./bot";
import { buyPerk, completeVault, freshMeta, PERK_IDS, perkCost, setupFor } from "./meta";
import { VAULT_GROWTH, VAULT_PRICES } from "./tuning";

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

describe("pacing — the whole of Run 1 and a boosted Run 1 replay", () => {
  const first = SEEDS.map((s) => playGreedy(s, 900));
  const med = (pick: (r: (typeof first)[number]) => number | undefined, rs = first) =>
    median(rs.map((r) => pick(r) ?? Number.POSITIVE_INFINITY));

  it("wakes the bot by about two and a half minutes", () => {
    expect(med((r) => r.botAwakeAt)).toBeLessThan(150);
  });

  it("buys the auto-seller at about 3–5 minutes", () => {
    const t = med((r) => r.sellerAt);
    expect(t).toBeGreaterThanOrEqual(180);
    expect(t).toBeLessThanOrEqual(300);
  });

  it("buys auto-spin after the auto-seller and before the vault", () => {
    const t = med((r) => r.autoSpinAt);
    expect(t).toBeGreaterThan(med((r) => r.sellerAt));
    expect(t).toBeLessThan(med((r) => r.vaultAt));
  });

  it("buys Vault Case I at 6–10 minutes", () => {
    const t = med((r) => r.vaultAt);
    expect(t).toBeGreaterThan(360);
    expect(t).toBeLessThan(600);
  });

  it("never leaves the tray stuck full for long", () => {
    for (const r of first) expect(r.longestTrayFull).toBeLessThan(10);
  });

  it("a boosted Run 1 replay (one vault, cheapest perk) catches up in 1–2 min and vaults again by 5–7 min", () => {
    const second = SEEDS.map((s, i) => {
      const meta = freshMeta();
      completeVault(meta, first[i]!.lifetimeEarnings, "vault1", s);
      const cheapest = [...PERK_IDS].sort((a, b) => (perkCost(a, 0) ?? Infinity) - (perkCost(b, 0) ?? Infinity))[0]!;
      buyPerk(meta, cheapest);
      // the Run 1 replay: Run 2 has its own content and tests (Task 9)
      return playGreedy(s + 100, 900, HUMAN, { ...setupFor(meta), run: 1, vaultPrice: VAULT_PRICES[0] * VAULT_GROWTH });
    });
    const caughtUp = med((r) => r.allUnlockedAt, second);
    expect(caughtUp).toBeGreaterThan(60);
    expect(caughtUp).toBeLessThan(120);
    const again = med((r) => r.vaultAt, second);
    expect(again).toBeGreaterThan(300);
    expect(again).toBeLessThan(420);
  });
});

describe("pacing — Runs 2 and 3 (spec §10)", () => {
  // chain: Run 1 → Vault I → Run 2 → Vault II → Run 3 → Vault III → Run 3 replay, cheapest perk each time
  const chain = SEEDS.map((s) => {
    const meta = freshMeta();
    const reports = [];
    let earnings = playGreedy(s, 900).lifetimeEarnings;
    for (const trophy of ["vault1", "vault2", "vault3"]) {
      completeVault(meta, earnings, trophy, s);
      const cheapest = [...PERK_IDS].sort(
        (a, b) => (perkCost(a, meta.perks[a]) ?? Infinity) - (perkCost(b, meta.perks[b]) ?? Infinity),
      )[0]!;
      buyPerk(meta, cheapest);
      const r = playGreedy(s + 100 * meta.loops, 900, HUMAN, setupFor(meta));
      reports.push(r);
      earnings = r.lifetimeEarnings;
    }
    return reports; // [run2, run3, run3 replay]
  });
  const med = (i: number, pick: (r: PacingReport) => number | undefined) => median(chain.map((c) => pick(c[i]!) ?? Infinity));

  it("Run 2 catches up to Run 1's shelf in 1–2 min", () => {
    const t = med(0, (r) => r.runCasesAt[1]);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
  });
  it("Run 2 buys the locker by about 2–4 min and Vault II at 6–10 min, reaching High", () => {
    expect(med(0, (r) => r.lockerAt)).toBeLessThan(240);
    const v = med(0, (r) => r.vaultAt);
    expect(v).toBeGreaterThan(360);
    expect(v).toBeLessThan(600);
    expect(median(chain.map((c) => c[0]!.topStage))).toBeGreaterThanOrEqual(3);
  });
  it("Run 3 catches up to Run 2's shelf in 1–2 min, Vault III at 6–10 min, reaching Tripping", () => {
    const t = med(1, (r) => r.runCasesAt[2]);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
    const v = med(1, (r) => r.vaultAt);
    expect(v).toBeGreaterThan(360);
    expect(v).toBeLessThan(600);
    expect(median(chain.map((c) => c[1]!.topStage))).toBeGreaterThanOrEqual(4);
  });
  it("a Run 3 replay catches up in 1–2 min and vaults again by 5–7 min", () => {
    const t = med(2, (r) => r.runCasesAt[3]);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
    const v = med(2, (r) => r.vaultAt);
    expect(v).toBeGreaterThan(300);
    expect(v).toBeLessThan(420);
  });
  it("never leaves the tray stuck full for long", () => {
    for (const c of chain) for (const r of c) expect(r.longestTrayFull).toBeLessThan(10);
  });
  it("presses contracts in Run 2", () => {
    expect(median(chain.map((c) => c[0]!.contracts))).toBeGreaterThan(0);
  });
});
