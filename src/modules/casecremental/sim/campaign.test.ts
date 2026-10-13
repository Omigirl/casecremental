import { describe, expect, it } from "vitest";
import { botSpeed, botSpeedCost, botSpeedLevels } from "./botOpener";
import { capRaisedLater, catchUpBoost, runCaseIds, runContent, runNumber, vaultPriceFor } from "./campaign";
import { completeVault, freshMeta, setupFor } from "./meta";
import { DEFAULT_SETUP, Run } from "./run";
import { BOT_SPEED_ANCHORS, CATCH_UP_PER_VAULT, VAULT_GROWTH, VAULT_PRICES } from "./tuning";
import { upgradeCap, upgradeCost } from "./upgrades";

describe("the campaign", () => {
  it("numbers runs by vaults opened, staying on the last run after it", () => {
    expect([0, 1, 2, 3, 4, 9].map(runNumber)).toEqual([1, 2, 3, 4, 4, 4]);
  });

  it("prices each run's vault, and replays of the last run grow", () => {
    for (let i = 0; i < 4; i++) expect(vaultPriceFor(i)).toBe(VAULT_PRICES[i]);
    expect(vaultPriceFor(5)).toBe(VAULT_PRICES[3] * VAULT_GROWTH ** 2);
  });

  it("multiplies each opened vault's catch-up boost, The Last Case's again for every replay", () => {
    expect(catchUpBoost(0)).toBe(1);
    expect(catchUpBoost(1)).toBe(CATCH_UP_PER_VAULT[0]);
    expect(catchUpBoost(3)).toBeCloseTo(CATCH_UP_PER_VAULT[0] * CATCH_UP_PER_VAULT[1] * CATCH_UP_PER_VAULT[2], 9);
    expect(catchUpBoost(6) / catchUpBoost(5)).toBeCloseTo(CATCH_UP_PER_VAULT[3], 9);
    // a replay's vault grows a little faster than its income, never much: the 90 s rule holds replay after replay
    expect(VAULT_GROWTH / CATCH_UP_PER_VAULT[3]).toBeGreaterThanOrEqual(1);
    expect(VAULT_GROWTH / CATCH_UP_PER_VAULT[3]).toBeLessThan(1.1);
  });

  it("Run 4: nine cases, multi-open x5, bot speed to x100, the bot opens three, the Upgrader and evolutions", () => {
    expect(runCaseIds(4)).toHaveLength(9);
    expect(runCaseIds(4).slice(-2)).toEqual(["glitch", "feverdream"]);
    expect(runContent(4)).toMatchObject({
      multiOpen: 5,
      botMultiOpen: 3,
      locker: true,
      autoContract: true,
      upgrader: true,
      evolutions: true,
    });
    expect([1, 2, 3].every((r) => !runContent(r).upgrader && !runContent(r).evolutions)).toBe(true);
    expect(botSpeed(14)).toBeCloseTo(100, 9);
    expect(botSpeedCost(11, 3)).toBeNull();
    expect(botSpeedCost(11, 4)).not.toBeNull();
    expect(capRaisedLater((r) => botSpeedLevels(r), 11, 3)).toBe(true); // Run 3's top bot speed says NEXT RUN
  });

  it("caps multi-open by run: x2, x3, x5", () => {
    expect([1, 2, 3].map((r) => upgradeCap("multiOpen", r))).toEqual([1, 2, 4]);
    expect(upgradeCost("multiOpen", 1, 1)).toBeNull();
    expect(upgradeCost("multiOpen", 1, 2)).not.toBeNull();
    expect(capRaisedLater((r) => upgradeCap("multiOpen", r), 1, 1)).toBe(true);
    expect(capRaisedLater((r) => upgradeCap("multiOpen", r), 4, 3)).toBe(false);
  });

  it("keeps Run 1's bot speeds and reaches x20 and x50 at the later caps", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8, 9);
    expect(botSpeed(3)).toBeCloseTo(8 ** (3 / 5), 9);
    expect(botSpeed(8)).toBeCloseTo(20, 9);
    expect(botSpeed(11)).toBeCloseTo(50, 9);
    expect(BOT_SPEED_ANCHORS.at(-1)).toEqual([14, 100]);
    expect(botSpeedCost(5, 1)).toBeNull();
    expect(botSpeedCost(5, 2)).not.toBeNull();
    expect(botSpeedCost(8, 2)).toBeNull();
  });

  it("a Run 1 shelf has three cases and the vault needs only those", () => {
    expect(runCaseIds(1)).toEqual(["bootcamp", "wildwood", "bedrock"]);
    const run = new Run(1, { ...DEFAULT_SETUP, startCash: 1e9 });
    expect(run.runCases()).toEqual(["bootcamp", "wildwood", "bedrock"]);
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    expect(run.vaultShown()).toBe(true);
  });

  it("the run after a vault is Run 2, with its vault price", () => {
    const m = freshMeta();
    completeVault(m, 1e9, "vault1", 1);
    const setup = setupFor(m);
    expect(setup.run).toBe(2);
    expect(setup.vaultPrice).toBe(VAULT_PRICES[1]);
  });
});
