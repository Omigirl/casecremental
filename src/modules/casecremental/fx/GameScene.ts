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
  /** Pixi throws if an Application is destroyed before its async init resolves. */
  let appReady = false;
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
      appReady = false;
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
            // destroyed (or remounted) while init was running: tear down now that it is safe
            a.destroy(true);
            return;
          }
          appReady = true;
          host.appendChild(a.canvas);
          world = new World(a, controller);
          a.ticker.add(tick);
          if (!running) a.ticker.stop();
          controller.mounted = true;
        })
        .catch((error: unknown) => {
          console.error("[casecremental] renderer failed to start", error);
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
      const a = app;
      app = null;
      // Still initializing → the init callback destroys it once Pixi can be torn down safely.
      if (a && appReady) a.destroy(true, { children: true });
      appReady = false;
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
