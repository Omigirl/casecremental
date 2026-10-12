import type { ModuleAgentApi } from "@idosgames/module-sdk";
import { skinById, skinDisplayName } from "../sim/content/cases";
import type { CharmId } from "../sim/charms";
import { gridSize, gridStalled } from "../sim/grid";
import { lockerCapacity, lockerCounts, tradeUpRarity } from "../sim/locker";
import { PERK_IDS, type PerkId } from "../sim/meta";
import { RARITY_ORDER } from "../sim/rarity";
import type { ActionResult, CardSpot } from "../sim/run";
import { GRID_RESERVES } from "../sim/tuning";
import type { RarityId } from "../sim/types";
import { UPGRADE_IDS, type UpgradeId } from "../sim/upgrades";
import type { Action, GameController } from "./controller";

// What the AI Coder's agent (and a human in the preview) can see and do inside the canvas.
// Actions go through controller.act — the same path as the player's input.

type Args = Record<string, unknown> | undefined;
const cents = (n: number) => Math.round(n * 100) / 100;
const STORE_FROM: readonly (CardSpot | "tray")[] = ["bench", "bot", "locker", "tray"];

export function createAgentApi(c: GameController): ModuleAgentApi {
  const run = async (action: Action): Promise<ActionResult> => c.act(action);
  return {
    state() {
      const s = c.run.state;
      const b = s.bench;
      return {
        mounted: c.mounted,
        playing: c.running,
        time: Math.round(s.time * 10) / 10,
        cash: cents(s.cash),
        lifetimeEarnings: cents(s.lifetimeEarnings),
        run: c.run.setup.run,
        stage: s.stage,
        combo: s.combo,
        timeScale: c.timeScale,
        unlocked: [...s.unlocked],
        upgrades: { ...s.upgrades },
        tray: s.tray.length,
        cases: c.run
          .runCases()
          .filter((id) => s.unlocked.includes(id))
          .map((id) => {
            const count = c.run.openCount(id);
            return { id, count, charge: cents(c.run.casePrice(id) * count) };
          }),
        bot: {
          awake: s.bot.awake,
          speedLevel: s.bot.speedLevel,
          caseChoice: s.bot.caseChoice,
          spinning: s.bot.spin !== null,
          multiLevel: s.bot.multiLevel,
          cards: s.bot.cards.map((d) => d?.rarity ?? null),
        },
        seller: { ...s.seller },
        locker: {
          on: s.locker.on,
          items: s.locker.items.length,
          counts: lockerCounts(s.locker.items),
          capacity: lockerCapacity(s.locker.sizeLevel),
          sizeLevel: s.locker.sizeLevel,
          collect: s.locker.collect,
          ready: tradeUpRarity(s.locker.items),
          press: s.locker.press ? { rarity: s.locker.press.rarity, elapsed: s.locker.press.elapsed } : null,
          cards: s.locker.cards.map((d) => d?.rarity ?? null),
          auto: s.locker.auto,
        },
        grid: {
          on: s.grid.on,
          size: gridSize(s.grid.sizeLevel),
          filled: s.grid.cells.filter((c) => c !== null).length,
          stalled: gridStalled(s.grid),
          ticks: [...s.grid.ticks],
          reserve: s.grid.reserve,
        },
        dayJob: s.dayJob,
        vault: s.vault?.phase ?? null,
        over: s.over,
        meta: { clout: c.meta.clout, loops: c.meta.loops, offer: c.meta.offer, picked: c.meta.picked },
        bench:
          b.phase === "spinning"
            ? { phase: b.phase, caseId: b.caseId, reels: b.reels.length, elapsed: b.elapsed, fullDuration: b.fullDuration }
            : b.phase === "revealed"
              ? {
                  phase: b.phase,
                  caseId: b.caseId,
                  cards: b.cards.map((d, slot) =>
                    d
                      ? {
                          slot,
                          skin: skinDisplayName(skinById(d.skinId)),
                          rarity: d.rarity,
                          wear: d.wear,
                          statTrak: d.statTrak,
                          value: cents(d.value),
                        }
                      : null,
                  ),
                }
              : { ...b },
      };
    },
    actions: {
      buyCase: (args: Args) => run({ type: "buyCase", caseId: String(args?.caseId ?? "") }),
      insertKey: () => run({ type: "insertKey" }),
      sell: async (args: Args) => {
        const slot = Number(args?.slot ?? 0);
        if (!Number.isInteger(slot))
          throw new Error(`slot must be a whole number (got ${JSON.stringify(args?.slot)}); the slots are listed in the bench state`);
        return run({ type: "sell", slot });
      },
      unlockCase: (args: Args) => run({ type: "unlockCase", caseId: String(args?.caseId ?? "") }),
      buyUpgrade: async (args: Args) => {
        const id = String(args?.id ?? "");
        if (!UPGRADE_IDS.includes(id as UpgradeId)) throw new Error(`unknown upgrade "${id}"; valid: ${UPGRADE_IDS.join(", ")}`);
        return c.act({ type: "buyUpgrade", id: id as UpgradeId });
      },
      claim: (args: Args) => run({ type: "claim", index: Number(args?.index ?? 0) }),
      wakeBot: () => run({ type: "wakeBot" }),
      buyBotSpeed: () => run({ type: "buyBotSpeed" }),
      buyBotMulti: () => run({ type: "buyBotMulti" }),
      sellBot: (args: Args) => run({ type: "sellBot", slot: Number(args?.slot ?? 0) }),
      setBotCase: (args: Args) => run({ type: "setBotCase", caseId: args?.caseId == null ? null : String(args.caseId) }),
      buySeller: () => run({ type: "buySeller" }),
      buySellerSpeed: () => run({ type: "buySellerSpeed" }),
      setSellerThreshold: async (args: Args) => {
        const r = String(args?.rarity ?? "");
        if (!RARITY_ORDER.includes(r as RarityId)) throw new Error(`unknown rarity "${r}"; valid: ${RARITY_ORDER.join(", ")}`);
        return c.act({ type: "setSellerThreshold", rarity: r as RarityId });
      },
      buyLocker: () => run({ type: "buyLocker" }),
      buyLockerSize: () => run({ type: "buyLockerSize" }),
      setCollect: async (args: Args) => {
        if (args?.rarity == null) return c.act({ type: "setCollect", rarity: null });
        const r = String(args.rarity);
        if (!RARITY_ORDER.includes(r as RarityId)) throw new Error(`unknown rarity "${r}"; valid: ${RARITY_ORDER.join(", ")} or null`);
        return c.act({ type: "setCollect", rarity: r as RarityId });
      },
      storeCard: async (args: Args) => {
        const from = String(args?.from ?? "");
        if (!STORE_FROM.includes(from as CardSpot | "tray")) throw new Error(`unknown spot "${from}"; valid: ${STORE_FROM.join(", ")}`);
        const slot = Number(args?.slot ?? 0);
        if (!Number.isInteger(slot)) throw new Error(`slot must be a whole number (got ${JSON.stringify(args?.slot)})`);
        return c.act({ type: "storeCard", from: from as CardSpot | "tray", slot });
      },
      tradeUp: () => run({ type: "tradeUp" }),
      sellLocker: (args: Args) => run({ type: "sellLocker", slot: args?.slot === undefined ? undefined : Number(args.slot) }),
      buyAutoContract: () => run({ type: "buyAutoContract" }),
      buyGrid: () => run({ type: "buyGrid" }),
      buyGridRate: () => run({ type: "buyGridRate" }),
      buyGridSize: () => run({ type: "buyGridSize" }),
      setGridReserve: async (args: Args) => {
        const reserve = Number(args?.reserve);
        if (!(GRID_RESERVES as readonly number[]).includes(reserve))
          throw new Error(`reserve must be one of ${GRID_RESERVES.join(", ")} (got ${JSON.stringify(args?.reserve)})`);
        return c.act({ type: "setGridReserve", reserve });
      },
      toggleGridTick: (args: Args) => run({ type: "toggleGridTick", caseId: String(args?.caseId ?? "") }),
      startDayJob: () => run({ type: "startDayJob" }),
      buyVault: () => run({ type: "buyVault" }),
      turnVaultKey: () => run({ type: "turnVaultKey" }),
      buyPerk: async (args: Args) => {
        const id = String(args?.id ?? "");
        if (!PERK_IDS.includes(id as PerkId)) throw new Error(`unknown perk "${id}"; valid: ${PERK_IDS.join(", ")}`);
        return c.act({ type: "buyPerk", id: id as PerkId });
      },
      pickCharm: (args: Args) => run({ type: "pickCharm", id: String(args?.id ?? "") as CharmId }),
      startNextRun: () => run({ type: "startNextRun" }),
      ...(import.meta.env.DEV
        ? {
            devStartRun: async (args: Args) => {
              const n = Number(args?.run);
              if (!Number.isInteger(n) || n < 1 || n > 3) throw new Error("run must be 1, 2 or 3");
              c.devStartRun(n);
              return { ok: true } as ActionResult;
            },
            devAddCash: async (args: Args) => {
              const n = Number(args?.amount);
              if (!Number.isFinite(n) || n <= 0) throw new Error("amount must be a positive number");
              c.devAddCash(n);
              return { ok: true } as ActionResult;
            },
          }
        : {}),
    },
    describeActions: {
      buyCase: "Buy a case onto the empty bench: { caseId } - a case id on this run's shelf (state().cases / unlocked).",
      insertKey: "Turn the key of the case on the bench; the reel starts spinning.",
      sell: "Sell a revealed skin: { slot? } (default 0; the slots are listed in the bench state).",
      unlockCase: "Unlock the next case in the ladder: { caseId }.",
      buyUpgrade: "Buy one level: { id: luck|appraiser|quickHands|multiOpen }.",
      claim: "Sell a claim-tray item by hand: { index }.",
      wakeBot: "Wake the bot: it then opens its own cases with your cash.",
      buyBotSpeed: "Buy one bot Speed level.",
      buyBotMulti: "Run 2 and later: the bot opens two cases per spin (once, needs the bot awake).",
      sellBot: "Sell one of the bot's waiting cards by hand: { slot? } (default 0; the cards are listed in the bot state).",
      setBotCase: "The case the bot opens: { caseId } or { caseId: null } for the dearest you can afford.",
      buySeller: "Buy the auto-seller (sells waiting cards, sets good ones aside in the tray).",
      buySellerSpeed: "Buy one auto-seller Speed level.",
      setSellerThreshold: "The rarest drop the auto-seller sells: { rarity: milspec|restricted|classified|covert|gold }.",
      buyLocker: "Run 2 and later: buy the locker (keeps skins; ten of a rarity trade up into one of the next).",
      buyLockerSize: "Buy one locker Size level (+10 slots).",
      setCollect:
        "The rarity the auto-seller sends to the locker instead of selling: { rarity: milspec|restricted|classified|covert } or { rarity: null } for off.",
      storeCard: "Put a card in the locker by hand (feeds the combo): { from: bench|bot|locker|tray, slot }.",
      tradeUp: "Press the oldest ten of the lowest ready rarity in the locker into one skin of the next rarity.",
      sellLocker: "Sell a contract result waiting on the locker by hand: { slot? } (default: the first one waiting).",
      buyAutoContract: "Run 3: the locker presses on its own (the Collect rarity, else the lowest ready).",
      buyGrid: "Run 3: buy the auto-buyer grid (needs the auto-seller): it buys ticked cases into cells and opens them on its own.",
      buyGridRate: "Buy one auto-buyer Rate level (it buys more often).",
      buyGridSize: "Buy one auto-buyer Size level (10 -> 20 -> 30 -> 50 cells).",
      setGridReserve: "The share of your cash the auto-buyer never spends: { reserve: 0.25|0.5|0.75 }.",
      toggleGridTick: "Tick or untick an unlocked case for the auto-buyer: { caseId } (none ticked = the dearest it may).",
      startDayJob: "Broke with an empty bench: take a ~3 s day job.",
      buyVault: "Buy Vault Case I (all cases unlocked); then turn its key, and the opening ends the run.",
      turnVaultKey: "Turn the devil key in Vault Case I's lock (opens it).",
      buyPerk: "Between runs: buy a perk with CLOUT: { id: startCash|luck|charmSlot|botAwake|biggerTray }.",
      pickCharm: "Between runs: toggle an offered charm for the next run: { id }.",
      startNextRun: "Between runs: start the next run.",
      ...(import.meta.env.DEV
        ? {
            devStartRun: "Dev builds: jump to a run with the meta kept: { run: 1|2|3 }.",
            devAddCash: "Dev builds: add cash: { amount }.",
          }
        : {}),
    },
  };
}
