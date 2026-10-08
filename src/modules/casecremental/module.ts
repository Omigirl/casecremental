import { defineModule, type Module } from "@idosgames/module-sdk";
import { createAgentApi } from "./game/agent";
import { GameController } from "./game/controller";
import { createGameScene } from "./fx/GameScene";
import { makeGamePanel } from "./ui/GamePanel";
import { initPrefs } from "./ui/prefs";

// Casecremental: a Scritchy Scratchy-style incremental where the scratch ticket is a weapon case.
// One controller for the session; the Pixi scene renders it, the React panel draws HUD and shop,
// and the agent surface exposes it — all three go through controller.act().
export const casecrementalModule: Module = defineModule({
  id: "casecremental",
  meta: {
    name: "Casecremental",
    type: "game",
    genre: "incremental",
    // Pixi renders through the scene; use "pixi" here if the SDK's engine union has it (Task 13, Step 1).
    engine: "dom",
  },
  setup(ctx) {
    initPrefs(); // language (remembered, else the browser's) and volumes
    const controller = new GameController();
    ctx.registerScene(createGameScene(controller));
    ctx.registerPanel({ id: "game", slot: "overlay", component: makeGamePanel(controller) });
    ctx.registerRoute({ id: "casecremental", label: "Casecremental", icon: "📦" });
    ctx.exposeToAgent(createAgentApi(controller));
  },
});
