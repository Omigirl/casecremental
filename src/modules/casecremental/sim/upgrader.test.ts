import { describe, expect, it } from "vitest";
import { runCaseIds } from "./campaign";
import { Run } from "./run";
import { DEFAULT_SETUP, type RunSnapshot } from "./runTypes";
import { LOADED_DICE_BONUS, UPGRADER_COST, UPGRADER_MULTS, UPGRADER_SPIN_SECONDS } from "./tuning";
import type { Drop, RarityId } from "./types";
import { buyUpgrader, rarityStepsFor, setUpgraderStake, setUpgraderTarget, upgraderChance, upgraderGo, upgraderResult } from "./upgrader";
import { createRng } from "./rng";

const DT = 1 / 30;
const drop = (id: number, rarity: RarityId, over: Partial<Drop> = {}): Drop => ({
  id,
  caseId: "feverdream",
  skinId: rarity === "milspec" ? "fd_lullaby" : "fd_mirrors",
  rarity,
  float: 0.1,
  wear: "MW",
  statTrak: false,
  value: 100,
  ...over,
});

/** A Run 4 with the locker and the Upgrader bought, and `items` in the locker. */
function run4(items: Drop[] = [], charms: Run["setup"]["charms"] = []): Run {
  const r = new Run(11, { ...DEFAULT_SETUP, run: 4, startCash: 1e18, charms });
  expect(r.buyLocker().ok).toBe(true);
  expect(buyUpgrader(r).ok).toBe(true);
  r.state.locker.items = items;
  r.drainEvents();
  return r;
}
const spinOut = (r: Run) => {
  for (let t = 0; t < UPGRADER_SPIN_SECONDS + 0.1; t += DT) r.tick(DT);
};

describe("the Upgrader's odds", () => {
  it("wins 0.9 / multiplier, +10 points with Loaded Dice, never past 0.95", () => {
    expect(UPGRADER_MULTS).toEqual([1.5, 2, 5, 10, 25, 100]);
    expect(upgraderChance(1.5, [])).toBeCloseTo(0.6, 9);
    expect(upgraderChance(100, [])).toBeCloseTo(0.009, 9);
    expect(upgraderChance(2, ["loadedDice"])).toBeCloseTo(0.45 + LOADED_DICE_BONUS, 9);
    expect(upgraderChance(1, ["loadedDice"])).toBe(0.95);
  });

  it("pays a skin one rarity up to x2, two up to x10, three beyond, never past ★", () => {
    expect([1.5, 2, 5, 10, 25, 100].map(rarityStepsFor)).toEqual([1, 1, 2, 2, 3, 3]);
    const inputs = [drop(1, "restricted"), drop(2, "restricted", { statTrak: true })];
    const won = upgraderResult(inputs, 25, createRng(3), () => 99);
    expect(won).toMatchObject({ id: 99, rarity: "gold", caseId: "feverdream", value: 200 * 25, statTrak: false });
    expect(won.float).toBeCloseTo(0.1, 9);
    expect(upgraderResult([drop(1, "covert")], 100, createRng(3), () => 1).rarity).toBe("gold");
  });
});

describe("the Upgrader", () => {
  it("is Run 4's, needs the locker, and is bought once", () => {
    const r3 = new Run(1, { ...DEFAULT_SETUP, run: 3, startCash: 1e18 });
    r3.buyLocker();
    expect(buyUpgrader(r3)).toEqual({ ok: false, reason: "not in this run" });
    const r = new Run(1, { ...DEFAULT_SETUP, run: 4, startCash: 1e18 });
    expect(buyUpgrader(r)).toEqual({ ok: false, reason: "buy the locker first" });
    r.buyLocker();
    const cash = r.state.cash;
    expect(buyUpgrader(r).ok).toBe(true);
    expect(r.state.cash).toBe(cash - UPGRADER_COST);
    expect(buyUpgrader(r)).toEqual({ ok: false, reason: "the upgrader is already bought" });
    expect(r.drainEvents().some((e) => e.type === "upgraderBought")).toBe(true);
  });

  it("stakes the whole rarity stack at GO and rolls the outcome then", () => {
    const r = run4([drop(1, "milspec"), drop(2, "restricted"), drop(3, "milspec")]);
    setUpgraderStake(r, "milspec");
    expect(setUpgraderTarget(r, 1).ok).toBe(true);
    expect(setUpgraderTarget(r, 6)).toEqual({ ok: false, reason: "unknown target" });
    expect(upgraderGo(r).ok).toBe(true);
    expect(r.state.locker.items.map((d) => d.id)).toEqual([2]);
    const spin = r.state.upgrader.spin!;
    expect(spin).toMatchObject({ rarity: "milspec", mult: 2, chance: 0.45, elapsed: 0 });
    expect(spin.inputs.map((d) => d.id)).toEqual([1, 3]);
    expect(spin.result !== null).toBe(spin.roll < spin.chance);
    expect(r.drainEvents().find((e) => e.type === "upgraderStarted")).toMatchObject({ win: spin.result !== null, mult: 2 });
  });

  it("blocks the press while it spins, and is blocked by the press and by waiting results", () => {
    const ten = Array.from({ length: 10 }, (_, i) => drop(i + 1, "milspec"));
    const r = run4([...ten, drop(50, "covert")]);
    setUpgraderStake(r, "covert");
    expect(upgraderGo(r).ok).toBe(true);
    expect(r.tradeUp()).toEqual({ ok: false, reason: "the upgrader is spinning" });
    expect(upgraderGo(r)).toEqual({ ok: false, reason: "the upgrader is spinning" });
    spinOut(r);
    r.state.locker.cards = [];
    expect(r.tradeUp().ok).toBe(true);
    r.state.locker.items.push(drop(51, "covert"));
    expect(upgraderGo(r)).toEqual({ ok: false, reason: "the press is busy" });
    r.state.locker.press = null;
    r.state.locker.cards = [drop(60, "classified")];
    expect(upgraderGo(r)).toEqual({ ok: false, reason: "take the results first" });
  });

  it("refuses an empty stake and keeps it picked (Review Focus 3)", () => {
    const r = run4([drop(1, "milspec")]);
    expect(upgraderGo(r)).toEqual({ ok: false, reason: "pick a stake first" });
    setUpgraderStake(r, "classified");
    expect(upgraderGo(r)).toEqual({ ok: false, reason: "nothing to stake" });
    expect(r.state.upgrader.stake).toBe("classified");
    expect(r.state.locker.items).toHaveLength(1);
  });

  it("puts a win on top of the locker like a contract result, and a loss is gone", () => {
    // find a seed of each outcome at x1.5 (60 % to win)
    const outcome = (seed: number) => {
      const r = run4([drop(1, "restricted")]);
      (r as unknown as { rng: ReturnType<typeof createRng> }).rng = createRng(seed);
      setUpgraderStake(r, "restricted");
      upgraderGo(r);
      return r;
    };
    let win: Run | null = null;
    let loss: Run | null = null;
    for (let seed = 1; (!win || !loss) && seed < 50; seed++) {
      const r = outcome(seed);
      if (r.state.upgrader.spin!.result) win ??= r;
      else loss ??= r;
    }
    spinOut(win!);
    expect(win!.state.upgrader.spin).toBeNull();
    expect(win!.state.locker.cards).toHaveLength(1);
    expect(win!.state.locker.cards[0]!.rarity).toBe("classified");
    expect(win!.drainEvents().find((e) => e.type === "upgraderDone")).toMatchObject({ win: true });
    spinOut(loss!);
    expect(loss!.state.locker.cards).toEqual([]);
    expect(loss!.state.locker.items).toEqual([]);
    expect(loss!.drainEvents().find((e) => e.type === "upgraderDone")).toMatchObject({ win: false, result: null });
  });

  it("ends a spin the same way after a reload (Review Focus 1)", () => {
    const r = run4([drop(1, "restricted"), drop(2, "restricted")]);
    setUpgraderStake(r, "restricted");
    setUpgraderTarget(r, 2);
    upgraderGo(r);
    for (let i = 0; i < 30; i++) r.tick(DT);
    const back = Run.fromSnapshot(JSON.parse(JSON.stringify(r.snapshot())) as RunSnapshot); // what the save stores
    expect(back.state.upgrader.spin).toEqual(r.state.upgrader.spin);
    spinOut(r);
    spinOut(back);
    expect(back.state.locker.cards).toEqual(r.state.locker.cards);
  });

  it("settles a running spin when the vault is bought (Review Focus 2)", () => {
    const r = run4([drop(1, "restricted")]);
    for (const id of runCaseIds(4).slice(1)) r.unlockCase(id);
    r.setup.vaultPrice = 1;
    setUpgraderStake(r, "restricted");
    upgraderGo(r);
    const won = r.state.upgrader.spin!.result;
    r.drainEvents();
    expect(r.buyVault().ok).toBe(true);
    expect(r.state.upgrader.spin).toBeNull();
    const sold = r.drainEvents().filter((e) => e.type === "sold");
    expect(sold.some((e) => e.type === "sold" && e.drop === won)).toBe(won !== null);
  });
});
