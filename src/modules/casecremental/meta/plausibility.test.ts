import { describe, expect, it } from "vitest";
import { HUMAN, playGreedy, type BotTimings } from "../sim/bot";
import { runNumber } from "../sim/campaign";
import { vaultFor } from "../sim/content/vaults";
import { buyPerk, completeVault, freshMeta, PERK_IDS, setupFor } from "../sim/meta";
import { LAST_RUN } from "../sim/tuning";
import { cappedEarnings, earningsFromScore, maxPlausibleLog10, scoreFor } from "./plausibility";

/** Faster than any human: every action a twentieth of a second. */
const FAST: BotTimings = { ...HUMAN, buy: 0.05, key: 0.05, sell: 0.05, reveal: 0.05 };

describe("plausibility", () => {
  it("scores earnings on a log scale and back", () => {
    expect(scoreFor(1.2e6)).toBe(6079);
    expect(scoreFor(0)).toBe(0);
    expect(scoreFor(1e300)).toBe(300000);
    expect(earningsFromScore(scoreFor(4.2e11))).toBeCloseTo(4.2e11, -9);
  });

  it("lets every fast greedy run of the campaign through with ×3 headroom, perks maxed as they come", () => {
    for (const seed of [1, 2]) {
      const meta = freshMeta();
      for (let i = 0; i <= LAST_RUN; i++) {
        // every run of the campaign, then one replay of the last
        const r = playGreedy(seed + 100 * i, 900, FAST, setupFor(meta));
        expect(r.vaultAt, `run ${i + 1} seed ${seed} never vaulted`).toBeDefined();
        const need = Math.log10(r.lifetimeEarnings) + 0.5;
        expect(
          maxPlausibleLog10(r.vaultAt!, meta.loops),
          `run ${i + 1} seed ${seed}: ${r.lifetimeEarnings} at ${r.vaultAt}s`,
        ).toBeGreaterThanOrEqual(need);
        completeVault(meta, r.lifetimeEarnings, vaultFor(runNumber(meta.loops)).trophy, seed);
        for (const id of PERK_IDS) while (buyPerk(meta, id).ok);
      }
    }
  }, 120_000);

  it("refuses what no player can earn", () => {
    expect(maxPlausibleLog10(60, 0)).toBeLessThan(6); // $1M in the first minute of Run 1
    expect(maxPlausibleLog10(600, 0)).toBeLessThan(11);
    expect(cappedEarnings(1e40, 600, 0)).toBe(10 ** maxPlausibleLog10(600, 0));
    expect(cappedEarnings(5e6, 600, 0)).toBe(5e6);
    expect(cappedEarnings(-5, 600, 0)).toBe(0);
  });
});
