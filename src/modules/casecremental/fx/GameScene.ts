import { Application, type Ticker } from "pixi.js";
import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
import type { GameController } from "../game/controller";
import type { AudioEngine } from "./audio/AudioEngine";
import { Camera } from "./camera";
import { canvasResolution } from "./pixel/screen";
import { blockSelection } from "./noSelect";
import { World } from "./World";

// The Pixi scene the host's Mode Router drives: created on mount, ticking only while active
// (suspend stops the ticker), destroyed for good on destroy.

export function createGameScene(controller: GameController, audio: AudioEngine, camera: Camera = new Camera()): EngineScene {
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
          // pixel art: no smoothing, and a whole device-pixel ratio so every world pixel stays square
          antialias: false,
          autoDensity: true,
          resolution: canvasResolution(window.devicePixelRatio),
        })
        // sprites, skins and the pixel font load before the first frame
        .then(() => (app === a ? World.create(a, controller, audio, camera) : null))
        .then((w) => {
          if (app !== a) {
            // destroyed (or remounted) while loading: tear down now that it is safe
            w?.destroy();
            a.destroy(true);
            return;
          }
          appReady = true;
          blockSelection(a.canvas);
          host.appendChild(a.canvas);
          world = w;
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
      // the World knows where the vault is (a lobby trip mid-fanfare resumes it, not restarts it); before it
      // exists, the music stays off and its restore() picks and starts it (no stage loop first)
      if (world) world.resumeMusic();
      app?.ticker?.start();
    },
    suspend() {
      running = false;
      controller.running = false;
      audio.setMusicOn(false);
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
