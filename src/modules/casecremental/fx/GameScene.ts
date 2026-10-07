import { Application, type Ticker } from "pixi.js";
import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
import type { GameController } from "../game/controller";
import { World } from "./World";

// The Pixi scene the host's Mode Router drives: created on mount, ticking only while active
// (suspend stops the ticker), destroyed for good on destroy.

export function createGameScene(controller: GameController): EngineScene {
  let app: Application | null = null;
  let world: World | null = null;
  let ready: Promise<void> = Promise.resolve();
  let running = false;

  const tick = (ticker: Ticker): void => {
    if (!world) return;
    const seconds = ticker.deltaMS / 1000;
    const scale = world.timeScale(seconds);
    controller.timeScale = scale;
    controller.step(seconds);
    world.update(seconds, scale);
  };

  return {
    surface: "fullbleed-canvas",
    mount(ctx: SceneMountContext) {
      const host = ctx.host;
      const a = new Application();
      app = a;
      ready = a
        .init({
          resizeTo: host,
          background: "#07080c",
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        })
        .then(() => {
          if (app !== a) {
            a.destroy(true);
            return;
          }
          host.appendChild(a.canvas);
          world = new World(a, controller);
          a.ticker.add(tick);
          if (!running) a.ticker.stop();
          controller.mounted = true;
        });
    },
    ready: () => ready,
    activate() {
      running = true;
      controller.running = true;
      app?.ticker?.start();
    },
    suspend() {
      running = false;
      controller.running = false;
      app?.ticker?.stop();
    },
    destroy() {
      world?.destroy();
      world = null;
      app?.destroy(true, { children: true });
      app = null;
      controller.mounted = false;
      controller.running = false;
    },
    capture() {
      return new Promise<Blob | null>((resolve) => {
        const a = app;
        if (!a || !world) return resolve(null);
        const timer = setTimeout(() => resolve(null), 1500);
        try {
          a.renderer.render(a.stage); // draw and read in the same tick (WebGL clears afterwards)
          (a.canvas as HTMLCanvasElement).toBlob((blob) => {
            clearTimeout(timer);
            resolve(blob);
          }, "image/png");
        } catch {
          clearTimeout(timer);
          resolve(null);
        }
      });
    },
  };
}
