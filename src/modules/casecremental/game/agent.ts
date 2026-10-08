import type { ModuleAgentApi } from "@idosgames/module-sdk";
import { skinById, skinDisplayName } from "../sim/content/cases";
import type { ActionResult } from "../sim/run";
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
    },
    describeActions: {
      buyCase: "Buy a case onto the empty bench: { caseId: bootcamp|wildwood|bedrock }.",
      insertKey: "Turn the key of the case on the bench; the reel starts spinning.",
      sell: "Sell the revealed skin.",
      unlockCase: "Unlock the next case in the ladder: { caseId }.",
      buyUpgrade: "Buy one level: { id: luck|appraiser|quickHands }.",
    },
  };
}
