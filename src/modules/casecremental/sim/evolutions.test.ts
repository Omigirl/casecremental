import { describe, expect, it } from "vitest";
import { AUTOSPIN_DELAY_LEVELS } from "./autoSpin";
import { SELLER_SPEED_LEVELS } from "./autoSeller";
import { botSpeedLevels } from "./botOpener";
import { runCaseIds } from "./campaign";
import { botRoll } from "./evolved";
import { buyEvolution, recipeDone, RECIPES } from "./evolutions";
import { Run } from "./run";
import { DEFAULT_SETUP } from "./runTypes";
import { ASSEMBLY_FREE_EVERY, EVOLUTION_COSTS, HOT_HAND_LUCK, MONEY_PRINTER_MULT, SLOT_MACHINE_OPEN } from "./tuning";
import { upgradeCap } from "./upgrades";

const DT = 1 / 30;
const rich = (run = 4) => new Run(5, { ...DEFAULT_SETUP, run, startCash: 1e18 });
const maxUpgrade = (r: Run, id: "luck" | "appraiser" | "quickHands" | "multiOpen") => {
  r.state.upgrades[id] = upgradeCap(id, r.setup.run);
};

describe("evolution recipes", () => {
  it("are the spec's pairs", () => {
    expect(RECIPES).toEqual({
      slotMachine: [
        { kind: "upgrade", id: "quickHands" },
        { kind: "upgrade", id: "multiOpen" },
      ],
      cartel: [{ kind: "botSpeed" }, { kind: "upgrade", id: "luck" }],
      moneyPrinter: [{ kind: "upgrade", id: "appraiser" }, { kind: "sellerSpeed" }],
      assemblyLine: [{ kind: "autoSpinDelay" }, { kind: "upgrade", id: "multiOpen" }],
      hotHand: [
        { kind: "upgrade", id: "luck" },
        { kind: "combo", n: 50 },
      ],
    });
  });

  it("complete at this run's caps, and Hot Hand on the run's best hand combo", () => {
    const r = rich();
    expect(recipeDone(r, "slotMachine")).toBe(false);
    maxUpgrade(r, "quickHands");
    maxUpgrade(r, "multiOpen");
    expect(recipeDone(r, "slotMachine")).toBe(true);
    r.state.bot.speedLevel = botSpeedLevels(4);
    maxUpgrade(r, "luck");
    expect(recipeDone(r, "cartel")).toBe(true);
    maxUpgrade(r, "appraiser");
    r.state.seller.speedLevel = SELLER_SPEED_LEVELS;
    expect(recipeDone(r, "moneyPrinter")).toBe(true);
    r.state.autoSpin.delayLevel = AUTOSPIN_DELAY_LEVELS;
    expect(recipeDone(r, "assemblyLine")).toBe(true);
    expect(recipeDone(r, "hotHand")).toBe(false);
    r.state.combo = 50;
    r.tick(DT); // the tick records the best combo
    r.state.combo = 0;
    expect(r.state.evolutions.bestCombo).toBe(50);
    expect(recipeDone(r, "hotHand")).toBe(true);
  });
});

describe("buying an evolution", () => {
  it("needs Run 4, a complete recipe and the cash, once", () => {
    const r3 = rich(3);
    maxUpgrade(r3, "quickHands");
    maxUpgrade(r3, "multiOpen");
    expect(buyEvolution(r3, "slotMachine")).toEqual({ ok: false, reason: "not in this run" });
    const r = rich();
    expect(buyEvolution(r, "slotMachine")).toEqual({ ok: false, reason: "finish the recipe first" });
    maxUpgrade(r, "quickHands");
    maxUpgrade(r, "multiOpen");
    const cash = r.state.cash;
    expect(buyEvolution(r, "slotMachine").ok).toBe(true);
    expect(r.state.cash).toBe(cash - EVOLUTION_COSTS.slotMachine);
    expect(buyEvolution(r, "slotMachine")).toEqual({ ok: false, reason: "already evolved" });
    expect(r.drainEvents().find((e) => e.type === "evolved")).toEqual({ type: "evolved", id: "slotMachine" });
  });
});

describe("what evolutions do", () => {
  it("Slot Machine opens ten per BUY, or as many as you can afford (Review Focus 4)", () => {
    const r = rich();
    maxUpgrade(r, "quickHands");
    maxUpgrade(r, "multiOpen");
    expect(r.openCount("bootcamp")).toBe(5);
    buyEvolution(r, "slotMachine");
    expect(r.openCount("bootcamp")).toBe(SLOT_MACHINE_OPEN);
    r.state.cash = r.casePrice("bootcamp") * 3.5;
    expect(r.openCount("bootcamp")).toBe(3);
    r.state.cash = r.casePrice("bootcamp") * 20;
    expect(r.buyCase("bootcamp").ok).toBe(true);
    r.insertKey();
    expect(r.state.bench.phase === "spinning" && r.state.bench.reels.length).toBe(10);
  });

  it("Cartel keeps the better of two rolls for each of the bot's cases, as one open", () => {
    const plain = rich();
    const cartel = rich();
    cartel.state.evolutions.owned.push("cartel");
    let plainValue = 0;
    let cartelValue = 0;
    for (const r of [plain, cartel]) {
      r.wakeBot();
      r.state.bot.wakeLeft = 0;
      r.state.bot.speedLevel = 14;
    }
    for (let i = 0; i < 3000; i++) {
      for (const r of [plain, cartel]) {
        r.tick(DT);
        for (const e of r.drainEvents()) {
          if (e.type !== "botSpinStarted") continue;
          if (r === plain) plainValue += e.drops[0]!.value;
          else cartelValue += e.drops[0]!.value;
        }
        r.state.bot.cards = [];
      }
    }
    expect(cartelValue).toBeGreaterThan(plainValue * 1.2);
    expect(cartel.state.opened).toBeLessThanOrEqual(plain.state.opened + 5); // one open per case, not two
  });

  it("Cartel's two rolls both see the same opened count (Lucky Seven never fires on a discarded roll)", () => {
    const r = rich();
    r.state.evolutions.owned.push("cartel");
    r.state.opened = 5;
    const seen: number[] = [];
    const roll = r.rollFor.bind(r);
    r.rollFor = (...a: Parameters<Run["rollFor"]>) => {
      const d = roll(...a);
      seen.push(r.state.opened);
      return d;
    };
    botRoll(r, "bootcamp");
    expect(seen).toEqual([6, 6]);
    expect(r.state.opened).toBe(6);
  });

  it("Money Printer triples the auto-seller's sales, never a hand sale", () => {
    const r = rich();
    r.buySeller();
    r.setSellerThreshold("gold");
    r.state.evolutions.owned.push("moneyPrinter");
    r.buyCase("bootcamp");
    r.insertKey();
    for (let i = 0; i < 300 && r.state.bench.phase !== "empty"; i++) r.tick(DT);
    const sale = r.drainEvents().find((e) => e.type === "sold");
    expect(sale?.type === "sold" && sale.source).toBe("seller");
    if (sale?.type === "sold") expect(sale.amount).toBeCloseTo(r.payout(sale.drop, false) * MONEY_PRINTER_MULT, 6);
  });

  it("Assembly Line: no delay, and every 25th auto-spin buy is a free case one tier up (the top case stays itself)", () => {
    const r = rich();
    for (const id of runCaseIds(4).slice(1, 3)) r.unlockCase(id); // bootcamp, wildwood, bedrock
    r.buySeller();
    r.buyAutoSpin();
    r.setAutoSpin(true);
    r.setAutoSpinCase("wildwood");
    r.state.evolutions.owned.push("assemblyLine");
    r.drainEvents();
    const bought: Array<{ caseId: string; free: boolean }> = [];
    for (let i = 0; bought.length < ASSEMBLY_FREE_EVERY && i < 200_000; i++) {
      r.tick(DT);
      for (const e of r.drainEvents()) if (e.type === "caseBought") bought.push({ caseId: e.caseId, free: e.free });
      const b = r.state.bench;
      if (b.phase === "revealed") b.cards.forEach((d, slot) => d && r.sell(slot));
    }
    expect(bought.slice(0, ASSEMBLY_FREE_EVERY - 1).every((b) => b.caseId === "wildwood" && !b.free)).toBe(true);
    expect(bought[ASSEMBLY_FREE_EVERY - 1]).toEqual({ caseId: "bedrock", free: true });
    r.setAutoSpinCase("bedrock");
    r.state.evolutions.pulls = ASSEMBLY_FREE_EVERY - 1;
    bought.length = 0;
    for (let i = 0; bought.length < 1 && i < 10_000; i++) {
      r.tick(DT);
      for (const e of r.drainEvents()) if (e.type === "caseBought") bought.push({ caseId: e.caseId, free: e.free });
      const b = r.state.bench;
      if (b.phase === "revealed") b.cards.forEach((d, slot) => d && r.sell(slot));
    }
    expect(bought[0]).toEqual({ caseId: "bedrock", free: true });
  });

  it("Hot Hand adds five Luck levels to your bench's rolls while the combo is 25 or more", () => {
    const seen: number[] = [];
    const r = rich();
    r.state.evolutions.owned.push("hotHand");
    const orig = r.rollFor.bind(r);
    r.rollFor = (caseId, forced, extra) => {
      seen.push(extra ?? 0);
      return orig(caseId, forced, extra);
    };
    r.state.combo = 24;
    r.buyCase("bootcamp");
    r.insertKey();
    r.state.bench = { phase: "empty" };
    r.state.combo = 25;
    r.buyCase("bootcamp");
    r.insertKey();
    expect(seen).toEqual([0, HOT_HAND_LUCK]);
  });
});
