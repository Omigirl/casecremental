import type { ModuleAgentApi } from "@idosgames/module-sdk";
import { skinById, skinDisplayName } from "../sim/content/cases";
import type { CharmId } from "../sim/charms";
import { PERK_IDS, type PerkId } from "../sim/meta";
import { RARITY_ORDER } from "../sim/rarity";
import type { ActionResult } from "../sim/run";
import type { RarityId } from "../sim/types";
import { UPGRADE_IDS, type UpgradeId } from "../sim/upgrades";
import type { Action, GameController } from "./controller";

// What the AI Coder's agent (and a human in the preview) can see and do inside the canvas.
// Actions go through controller.act — the same path as the player's input.

type Args = Record<string, unknown> | undefined;
const cents = (n: number) => Math.round(n * 100) / 100;

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
        stage: s.stage,
        combo: s.combo,
        timeScale: c.timeScale,
        unlocked: [...s.unlocked],
        upgrades: { ...s.upgrades },
        tray: s.tray.length,
        bot: {
          awake: s.bot.awake,
          speedLevel: s.bot.speedLevel,
          caseChoice: s.bot.caseChoice,
          spinning: s.bot.spin !== null,
          card: s.bot.card?.rarity ?? null,
        },
        seller: { ...s.seller },
        dayJob: s.dayJob,
        vault: s.vault?.phase ?? null,
        over: s.over,
        meta: { clout: c.meta.clout, loops: c.meta.loops, offer: c.meta.offer, picked: c.meta.picked },
        bench:
          b.phase === "spinning"
            ? { phase: b.phase, caseId: b.caseId, elapsed: b.elapsed, fullDuration: b.fullDuration }
            : b.phase === "revealed"
              ? {
                  phase: b.phase,
                  caseId: b.caseId,
                  skin: skinDisplayName(skinById(b.drop.skinId)),
                  rarity: b.drop.rarity,
                  wear: b.drop.wear,
                  statTrak: b.drop.statTrak,
                  value: cents(b.drop.value),
                }
              : { ...b },
      };
    },
    actions: {
      buyCase: (args: Args) => run({ type: "buyCase", caseId: String(args?.caseId ?? "") }),
      insertKey: () => run({ type: "insertKey" }),
      sell: () => run({ type: "sell" }),
      unlockCase: (args: Args) => run({ type: "unlockCase", caseId: String(args?.caseId ?? "") }),
      buyUpgrade: async (args: Args) => {
        const id = String(args?.id ?? "");
        if (!UPGRADE_IDS.includes(id as UpgradeId)) throw new Error(`unknown upgrade "${id}"; valid: ${UPGRADE_IDS.join(", ")}`);
        return c.act({ type: "buyUpgrade", id: id as UpgradeId });
      },
      claim: (args: Args) => run({ type: "claim", index: Number(args?.index ?? 0) }),
      wakeBot: () => run({ type: "wakeBot" }),
      buyBotSpeed: () => run({ type: "buyBotSpeed" }),
      sellBot: () => run({ type: "sellBot" }),
      setBotCase: (args: Args) => run({ type: "setBotCase", caseId: args?.caseId == null ? null : String(args.caseId) }),
      buySeller: () => run({ type: "buySeller" }),
      buySellerSpeed: () => run({ type: "buySellerSpeed" }),
      setSellerThreshold: async (args: Args) => {
        const r = String(args?.rarity ?? "");
        if (!RARITY_ORDER.includes(r as RarityId)) throw new Error(`unknown rarity "${r}"; valid: ${RARITY_ORDER.join(", ")}`);
        return c.act({ type: "setSellerThreshold", rarity: r as RarityId });
      },
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
    },
    describeActions: {
      buyCase: "Buy a case onto the empty bench: { caseId: bootcamp|wildwood|bedrock }.",
      insertKey: "Turn the key of the case on the bench; the reel starts spinning.",
      sell: "Sell the revealed skin.",
      unlockCase: "Unlock the next case in the ladder: { caseId }.",
      buyUpgrade: "Buy one level: { id: luck|appraiser|quickHands }.",
      claim: "Sell a claim-tray item by hand: { index }.",
      wakeBot: "Wake the bot: it then opens its own cases with your cash.",
      buyBotSpeed: "Buy one bot Speed level.",
      sellBot: "Sell the bot's waiting card by hand.",
      setBotCase: "The case the bot opens: { caseId } or { caseId: null } for the dearest you can afford.",
      buySeller: "Buy the auto-seller (sells waiting cards, sets good ones aside in the tray).",
      buySellerSpeed: "Buy one auto-seller Speed level.",
      setSellerThreshold: "The rarest drop the auto-seller sells: { rarity: milspec|restricted|classified|covert|gold }.",
      startDayJob: "Broke with an empty bench: take a ~3 s day job.",
      buyVault: "Buy Vault Case I (all cases unlocked); then turn its key, and the opening ends the run.",
      turnVaultKey: "Turn the devil key in Vault Case I's lock (opens it).",
      buyPerk: "Between runs: buy a perk with CLOUT: { id: startCash|luck|charmSlot|botAwake|biggerTray }.",
      pickCharm: "Between runs: toggle an offered charm for the next run: { id }.",
      startNextRun: "Between runs: start the next run.",
    },
  };
}
