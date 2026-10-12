import { describe, expect, it } from "vitest";
import { CASUAL, fullyBought, HUMAN, INCOME_WINDOW, playCampaign, playGreedy, playToFull, RUN_SECONDS, type BotTimings } from "./bot";
import { VAULTS } from "./content/vaults";
import { DEFAULT_SETUP, Run, type SimEvent } from "./run";
import { LAST_RUN } from "./tuning";
import { UPGRADE_IDS } from "./upgrades";

// The pacing players' own rules (finish spec §5): the two timing profiles, the shop cadence, and the helpers the
// pacing test measures with. The pacing targets themselves are in pacing.test.ts.

/** Every one-time purchase and upgrade the shop sells: not a case on the bench, not the vault. */
const PURCHASES = new Set<SimEvent["type"]>([
  "caseUnlocked",
  "upgradeBought",
  "botWoke",
  "botUpgraded",
  "botMultiBought",
  "sellerBought",
  "sellerUpgraded",
  "lockerBought",
  "lockerUpgraded",
  "autoContractBought",
  "autoSpinBought",
  "autoSpinUpgraded",
]);

/** Buys everything the run sells, with plenty of cash, until nothing more can be bought. */
function buyEverything(run: Run): void {
  run.state.cash = 1e18;
  const buys = [
    ...run.runCases().map((id) => () => run.unlockCase(id)),
    () => run.wakeBot(),
    () => run.buyBotSpeed(),
    () => run.buyBotMulti(),
    () => run.buySeller(),
    () => run.buySellerSpeed(),
    () => run.buyAutoSpin(),
    () => run.buyAutoSpinDelay(),
    () => run.buyLocker(),
    () => run.buyLockerSize(),
    () => run.buyAutoContract(),
    ...UPGRADE_IDS.map((id) => () => run.buyUpgrade(id)),
  ];
  for (let guard = 0; guard < 1000 && buys.some((buy) => buy().ok); guard++);
}

/** Seconds between the shop purchases of a 400 s Run 1. */
function purchaseGaps(timings: BotTimings): number[] {
  const at: number[] = [];
  playGreedy(1, 400, timings, DEFAULT_SETUP, { onEvent: (e, t) => void (PURCHASES.has(e.type) && at.push(t)) });
  return at.slice(1).map((t, i) => t - at[i]!);
}

describe("the timing profiles (finish spec §5)", () => {
  it("CASUAL is the spec's real player: slower hands, a look at the shop every 8 s", () => {
    expect(CASUAL).toEqual({ buy: 0.8, key: 0.8, sell: 1.2, reveal: 0.8, shopEvery: 8 });
  });

  it("GREEDY (HUMAN) keeps M1–M3's hands and shops at every free moment", () => {
    expect(HUMAN).toEqual({ buy: 0.3, key: 0.4, sell: 0.5, reveal: 0.25, shopEvery: 0 });
  });

  it("the CASUAL player buys at most one thing per look at the shop; the GREEDY one never waits", () => {
    const casual = purchaseGaps(CASUAL);
    expect(casual.length).toBeGreaterThan(5);
    expect(Math.min(...casual)).toBeGreaterThanOrEqual(CASUAL.shopEvery - 1e-6);
    expect(Math.min(...purchaseGaps(HUMAN))).toBeLessThan(CASUAL.shopEvery);
  });

  it("the vault waits for no look at the shop: CASUAL buys it as soon as it can", () => {
    const r = playGreedy(1, RUN_SECONDS, CASUAL, { ...DEFAULT_SETUP, vaultPrice: 1 });
    expect(r.vaultAt).toBeDefined();
    expect(r.vaultAt! - r.allUnlockedAt!).toBeLessThan(CASUAL.shopEvery);
  });
});

describe("fully bought (the 90 s rule's starting line)", () => {
  for (let n = 1; n <= LAST_RUN; n++) {
    it(`Run ${n}: not on a fresh run, yes once everything is bought, not with one level short`, () => {
      const r = new Run(1, { ...DEFAULT_SETUP, run: n });
      expect(fullyBought(r)).toBe(false);
      buyEverything(r);
      expect(fullyBought(r)).toBe(true);
      r.state.upgrades.luck -= 1;
      expect(fullyBought(r)).toBe(false);
    });
  }
});

describe("playToFull", () => {
  it("keeps the vault out of reach, gets the run fully bought, and measures its net income over the window", () => {
    const r = playToFull(1, HUMAN, DEFAULT_SETUP);
    expect(r.vaultAt).toBeUndefined();
    expect(r.fullAt).toBeDefined();
    expect(r.fullIncome!).toBeGreaterThan(0);
    expect(r.vaultPrice).toBe(DEFAULT_SETUP.vaultPrice);
    expect(Math.abs(r.endedAt - (r.fullAt! + INCOME_WINDOW))).toBeLessThan(0.1); // it stops once measured
  });
});

describe("playCampaign", () => {
  it("plays Run 1, then a run after each vault, the last a replay of the last run", () => {
    const legs = playCampaign(1, HUMAN, 60); // short legs: only the chain's shape matters here
    expect(legs).toHaveLength(VAULTS.length + 1);
    expect(legs.map((l) => l.run)).toEqual([...Array.from({ length: LAST_RUN }, (_, i) => i + 1), LAST_RUN]);
    expect(legs[0]!.setup).toEqual(DEFAULT_SETUP);
    expect(legs[1]!.setup.valueBoost).toBeGreaterThan(1);
    expect(legs.at(-1)!.setup.vaultPrice).toBeGreaterThan(legs.at(-2)!.setup.vaultPrice);
    expect(new Set(legs.map((l) => l.seed)).size).toBe(legs.length);
  });
});
