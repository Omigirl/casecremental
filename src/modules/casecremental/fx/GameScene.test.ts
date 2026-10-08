import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameController } from "../game/controller";

// Review fix: the host may destroy the scene while Pixi's async init is still running. Pixi throws
// if an Application is destroyed before init resolves, so the scene must defer that teardown.
// Pixi needs a real browser, so a fake Application stands in, failing exactly the way Pixi does.

const fake = vi.hoisted(() => {
  const apps: Array<{ resolveInit: () => void; destroyed: boolean }> = [];
  const worlds: unknown[] = [];
  class FakeApplication {
    initialized = false;
    destroyed = false;
    canvas = {};
    ticker = { add: () => {}, start: () => {}, stop: () => {} };
    resolveInit: () => void = () => {};
    init(): Promise<void> {
      apps.push(this);
      return new Promise<void>((resolve) => {
        this.resolveInit = () => {
          this.initialized = true;
          resolve();
        };
      });
    }
    destroy(): void {
      if (!this.initialized) throw new TypeError("this._cancelResize is not a function");
      this.destroyed = true;
    }
  }
  class FakeWorld {
    static async create(): Promise<FakeWorld> {
      return new FakeWorld();
    }
    constructor() {
      worlds.push(this);
    }
    destroy(): void {}
    timeScale(): number {
      return 1;
    }
    update(): void {}
  }
  return { apps, worlds, FakeApplication, FakeWorld };
});

vi.mock("pixi.js", () => ({ Application: fake.FakeApplication }));
vi.mock("./World", () => ({ World: fake.FakeWorld }));

const { createGameScene } = await import("./GameScene");

describe("GameScene mount / destroy", () => {
  beforeEach(() => {
    fake.apps.length = 0;
    fake.worlds.length = 0;
    vi.stubGlobal("window", { devicePixelRatio: 1 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("mounts a World once Pixi is ready", async () => {
    const controller = new GameController(1);
    const scene = createGameScene(controller);
    const host = { appendChild: vi.fn() };
    scene.mount({ host: host as unknown as HTMLElement });
    fake.apps[0]!.resolveInit();
    await scene.ready?.();
    expect(fake.worlds).toHaveLength(1);
    expect(host.appendChild).toHaveBeenCalledTimes(1);
    expect(controller.mounted).toBe(true);
  });

  it("survives destroy during init and tears the app down once init finishes", async () => {
    const controller = new GameController(1);
    const scene = createGameScene(controller);
    const host = { appendChild: vi.fn() };
    scene.mount({ host: host as unknown as HTMLElement });
    const pending = scene.ready?.();
    expect(() => scene.destroy()).not.toThrow();
    fake.apps[0]!.resolveInit();
    await pending;
    expect(fake.worlds).toHaveLength(0);
    expect(host.appendChild).not.toHaveBeenCalled();
    expect(fake.apps[0]!.destroyed).toBe(true);
    expect(controller.mounted).toBe(false);
  });
});
