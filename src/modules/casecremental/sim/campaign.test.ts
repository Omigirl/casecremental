import { describe, expect, it } from "vitest";
import { botSpeed, botSpeedCost } from "./botOpener";
import { capRaisedLater, runCaseIds, runNumber, vaultPriceFor } from "./campaign";
import { completeVault, freshMeta, setupFor } from "./meta";
import { DEFAULT_SETUP, Run } from "./run";
import { BOT_SPEED_ANCHORS, VAULT_GROWTH, VAULT_PRICES } from "./tuning";
import { upgradeCap, upgradeCost } from "./upgrades";

describe("the campaign", () => {
  it("numbers runs by vaults opened, staying on the last run after it", () => {
    expect([0, 1, 2, 3, 7].map(runNumber)).toEqual([1, 2, 3, 3, 3]);
  });

  it("prices each run's vault, and replays of the last run grow", () => {
    expect(vaultPriceFor(0)).toBe(VAULT_PRICES[0]);
    expect(vaultPriceFor(1)).toBe(VAULT_PRICES[1]);
    expect(vaultPriceFor(2)).toBe(VAULT_PRICES[2]);
    expect(vaultPriceFor(4)).toBe(VAULT_PRICES[2] * VAULT_GROWTH ** 2);
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
    expect(BOT_SPEED_ANCHORS.at(-1)).toEqual([11, 50]);
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
