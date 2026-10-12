import { describe, expect, it } from "vitest";
import { HUMAN, playGreedy, type BotTimings } from "../sim/bot";
import { runNumber } from "../sim/campaign";
import { VAULTS, vaultFor } from "../sim/content/vaults";
import { buyPerk, completeVault, freshMeta, PERK_IDS, setupFor } from "../sim/meta";
import { LAST_RUN, SERVER_MIN_REPLAY_SEC, SERVER_MIN_VAULT_SEC } from "../sim/tuning";
import { cappedEarnings, earningsFromScore, maxPlausibleLog10, minRunSeconds, scoreFor } from "./plausibility";

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
        // the server counts the vault only after a minimum run time: even this bot clears it by ×1.25
        expect(r.vaultAt!, `run ${i + 1} seed ${seed}: vault at ${r.vaultAt}s`).toBeGreaterThanOrEqual(minRunSeconds(meta.loops) * 1.25);
        completeVault(meta, r.lifetimeEarnings, vaultFor(runNumber(meta.loops)).trophy, seed);
        for (const id of PERK_IDS) while (buyPerk(meta, id).ok);
      }
    }
  }, 120_000);

  it("has a minimum run time per vault, then one for every replay", () => {
    expect(SERVER_MIN_VAULT_SEC).toHaveLength(VAULTS.length);
    expect(minRunSeconds(0)).toBe(SERVER_MIN_VAULT_SEC[0]);
    expect(minRunSeconds(VAULTS.length - 1)).toBe(SERVER_MIN_VAULT_SEC[VAULTS.length - 1]);
    expect(minRunSeconds(VAULTS.length + 7)).toBe(SERVER_MIN_REPLAY_SEC);
    // at most a third of the spec's CASUAL bands (finish spec §5: Run 1 from 360 s, Runs 2+ from 300 s)
    expect(SERVER_MIN_VAULT_SEC[0]).toBeLessThanOrEqual(360 / 3);
    for (const s of SERVER_MIN_VAULT_SEC.slice(1)) expect(s).toBeLessThanOrEqual(300 / 3);
  });

  it("refuses what no player can earn", () => {
    expect(maxPlausibleLog10(60, 0)).toBeLessThan(6); // $1M in the first minute of Run 1
    expect(maxPlausibleLog10(600, 0)).toBeLessThan(11);
    expect(cappedEarnings(1e40, 600, 0)).toBe(10 ** maxPlausibleLog10(600, 0));
    expect(cappedEarnings(5e6, 600, 0)).toBe(5e6);
    expect(cappedEarnings(-5, 600, 0)).toBe(0);
  });
});
