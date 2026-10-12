import { describe, expect, it, vi } from "vitest";
import { CASUAL, fullyBought, HUMAN, INCOME_WINDOW, playCampaign, playGreedy, playToFull, RUN_SECONDS, type BotTimings } from "./bot";
import { VAULTS } from "./content/vaults";
import { DEFAULT_SETUP, Run, type RunSetup, type SimEvent } from "./run";
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

/** When a player looked at the shop and when it bought something, over `seconds` of a run. */
function shopTimes(timings: BotTimings, setup: RunSetup = DEFAULT_SETUP, seconds = 400): { looks: number[]; buys: number[] } {
  const looks: number[] = [];
  const buys: number[] = [];
  playGreedy(1, seconds, timings, setup, {
    onLook: (t) => void looks.push(t),
    onEvent: (e, t) => void (PURCHASES.has(e.type) && buys.push(t)),
  });
  return { looks, buys };
}
const gaps = (ts: number[]) => ts.slice(1).map((t, i) => t - ts[i]!);

describe("the timing profiles (finish spec §5)", () => {
  it("CASUAL is the spec's real player: slower hands, a look at the shop every 8 s", () => {
    expect(CASUAL).toEqual({ buy: 0.8, key: 0.8, sell: 1.2, reveal: 0.8, shopEvery: 8 });
  });

  it("GREEDY (HUMAN) keeps M1–M3's hands and shops at every free moment", () => {
    expect(HUMAN).toEqual({ buy: 0.3, key: 0.4, sell: 0.5, reveal: 0.25, shopEvery: 0 });
  });

  it("the CASUAL player buys only at its looks, at least 8 s apart, often several rows at once; the GREEDY one never waits", () => {
    const casual = shopTimes(CASUAL);
    expect(casual.buys.length).toBeGreaterThan(5);
    // a purchase's event is drained on the next tick, one frame after its look
    for (const t of casual.buys)
      expect(
        casual.looks.some((l) => t - l >= 0 && t - l < 0.05),
        `bought at ${t}`,
      ).toBe(true);
    expect(Math.min(...gaps(casual.looks))).toBeGreaterThanOrEqual(CASUAL.shopEvery - 1e-6);
    expect(new Set(casual.buys).size).toBeLessThan(casual.buys.length); // some look bought more than one row
    expect(Math.min(...gaps(shopTimes(HUMAN).buys))).toBeLessThan(CASUAL.shopEvery);
  });

  it("a due look comes before selling: CASUAL still looks every ~8 s while a fast bot always has a card waiting", () => {
    // Run 3 with cash for everything (the vault out of reach): the first look buys the bot ×50 and its multi-open, and
    // its cards wait for whoever sells first — the player's 1.2 s sale must not keep the shop waiting
    const setup = { ...DEFAULT_SETUP, run: 3, startCash: 1e15, botAwake: true, vaultPrice: Number.POSITIVE_INFINITY };
    const { looks } = shopTimes(CASUAL, setup);
    expect(looks.length).toBeGreaterThan(40);
    expect(Math.max(...gaps(looks))).toBeLessThan(CASUAL.shopEvery + 2); // a look waits only for the action in hand
  });

  it("takes the day job when broke with the bench empty, auto-spin on or not (finish spec §3)", () => {
    // once auto-spin is on, the run is held broke for 20 s: the bench empties, and the player must take the day job
    const tick = Run.prototype.tick;
    let brokeFrom: number | null = null;
    const spy = vi.spyOn(Run.prototype, "tick").mockImplementation(function (this: Run, dt: number) {
      tick.call(this, dt);
      if (this.state.autoSpin.on) brokeFrom ??= this.state.time;
      if (brokeFrom !== null && this.state.time < brokeFrom + 20) this.state.cash = 0;
    });
    try {
      for (const timings of [HUMAN, CASUAL]) {
        brokeFrom = null;
        const jobs: number[] = [];
        playGreedy(1, RUN_SECONDS, timings, DEFAULT_SETUP, {
          onEvent: (e, t) => void (e.type === "dayJobStarted" && brokeFrom !== null && jobs.push(t)),
        });
        expect(brokeFrom).not.toBeNull();
        expect(jobs.length, `${timings === HUMAN ? "GREEDY" : "CASUAL"}: day jobs while broke`).toBeGreaterThan(0);
      }
    } finally {
      spy.mockRestore();
    }
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
