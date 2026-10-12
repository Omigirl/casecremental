import { defineModule, type Module } from "@idosgames/module-sdk";
import { createAgentApi } from "./game/agent";
import { GameController } from "./game/controller";
import { browserSlot } from "./game/save";
import { connectServer } from "./game/serverSync";
import { ServerMeta } from "./meta/bridge";
import { clientPort } from "./meta/clientPort";
import { CallQueue } from "./meta/queue";
import { AudioEngine } from "./fx/audio/AudioEngine";
import { Camera } from "./fx/camera";
import { createGameScene } from "./fx/GameScene";
import { makeGamePanel } from "./ui/GamePanel";
import { getPrefs, initPrefs, onPrefsChange } from "./ui/prefs";

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
    // one mixer for the session: it outlives the scene (a trip to the lobby only pauses the music)
    const audio = new AudioEngine();
    const applyVolumes = () => audio.setVolumes(getPrefs().music, getPrefs().sfx);
    applyVolumes();
    onPrefsChange(applyVolumes);
    // browsers start audio only after a user gesture
    window.addEventListener("pointerdown", () => audio.unlock());
    window.addEventListener("keydown", () => audio.unlock());
    const controller = new GameController(undefined, browserSlot()); // the run and the meta survive a reload
    window.addEventListener("pagehide", () => controller.saveNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") controller.saveNow();
    });
    // The meta lives on the Title too (plan F7): CLOUT, perks, trophies, the leaderboard. The local save above is
    // already restored (synchronously), so play never waits for this; offline, the calls wait in the queue.
    const server = new ServerMeta(clientPort(ctx.client), new CallQueue(safeStorage()));
    connectServer(controller, server);
    window.addEventListener("online", () => void server.pump());
    const camera = new Camera(); // the scene moves it; the overlay follows it
    ctx.registerScene(createGameScene(controller, audio, camera));
    ctx.registerPanel({ id: "game", slot: "overlay", component: makeGamePanel(controller, audio, camera) });
    ctx.registerRoute({ id: "casecremental", label: "Casecremental", icon: "📦" });
    ctx.exposeToAgent(createAgentApi(controller));
  },
});

/** localStorage, or none when the browser blocks it. */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
