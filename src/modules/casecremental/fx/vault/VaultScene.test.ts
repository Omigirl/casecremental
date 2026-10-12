import { Texture, TextureSource } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VAULTS } from "../../sim/content/vaults";
import type { AudioEngine } from "../audio/AudioEngine";
import type { HdLayer } from "../hd/HdLayer";
import { pixelViewport } from "../pixel/viewport";
import type { SpriteLibrary } from "../pixel/sprites";
import { kickBursts } from "./bursts";
import { VAULT_CUES } from "./cues";
import { vaultLook } from "./vaultLooks";
import { VaultScene } from "./VaultScene";

const tex = (w = 16, h = 16) => new Texture({ source: new TextureSource({ width: w, height: h }) });

// the drawn textures and the gradient font need a canvas: plain ones here (their look isn't under test)
vi.mock("./textures", () => ({
  canvasTexture: (w: number, h: number) => tex(w, h),
  vaultTextures: () => ({ soft: tex(128, 128), dot: tex(), star: tex(20, 20) }),
}));
vi.mock("../hd/font", () => ({
  moneyStyle: (fontSize: number) => ({ fontSize }),
  pixelStyle: (fontSize: number, fill: number) => ({ fontSize, fill }),
}));

const screen = { w: 1324, h: 824 };

function harness() {
  const sheets = new Map<string, Texture[]>();
  const get = vi.fn((id: string, f: { w: number; h: number; frames?: number }) => {
    if (!sheets.has(id))
      sheets.set(
        id,
        Array.from({ length: f.frames ?? 4 }, () => tex(f.w, f.h)),
      );
    return { frames: sheets.get(id)! };
  });
  const flash = vi.fn();
  const audio = { play: vi.fn(), stop: vi.fn() } as unknown as AudioEngine;
  const scene = new VaultScene({ get } as unknown as SpriteLibrary, { flash } as unknown as HdLayer, audio, { add: vi.fn() }, vi.fn());
  scene.layout(screen, pixelViewport(screen.w, screen.h).scale);
  return { scene, get, sheets, flash };
}

/** The key turned: the scene opens from the sim's t 0. */
function open(scene: VaultScene, t: number): void {
  scene.show("key", 0, [], 0);
  scene.show("opening", t, [], 0);
}

afterEach(() => vi.restoreAllMocks());

describe("VaultScene follows the run's vault", () => {
  it("starts as Vault I, and takes another vault's chest sheet, light and chaos (nothing for the same vault)", () => {
    const h = harness();
    expect(h.scene["chest"]["sprite"].texture).toBe(h.sheets.get("vault-case")![0]);
    for (const def of VAULTS) {
      h.scene.setVault(def);
      const look = vaultLook(def.id);
      expect(h.scene["chest"]["sprite"].texture, def.id).toBe(h.sheets.get(look.chest)![0]);
      expect(h.scene["chest"]["look"], def.id).toBe(look.light);
      expect(h.scene["rays"]["light"], def.id).toBe(look.light);
      expect(h.scene["chaos"]["look"], def.id).toBe(look.chaos);
      const calls = h.get.mock.calls.length;
      h.scene.setVault(def);
      expect(h.get.mock.calls.length, def.id).toBe(calls); // the same vault: a no-op
    }
  });

  it("flashes the impact in the vault's own pale colour", () => {
    for (const def of VAULTS) {
      const h = harness();
      h.scene.setVault(def);
      open(h.scene, VAULT_CUES.impact + 0.01);
      expect(h.flash, def.id).toHaveBeenCalledWith(vaultLook(def.id).light.impactFlash, 0.35);
    }
  });

  it("bursts each kick on its vault's count of spots (kickBursts), Vault I's two on its own spot", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // the spots' jitter, fixed
    const kick = VAULT_CUES.fireworks[1]!;
    for (const def of VAULTS) {
      const h = harness();
      h.scene.setVault(def);
      open(h.scene, kick - 0.01);
      const firework = vi.spyOn(h.scene, "firework");
      h.scene.show("opening", kick + 0.01, [], 0);
      const n = vaultLook(def.id).chaos.burstsPerKick;
      expect(
        firework.mock.calls.map((c) => c[0]),
        def.id,
      ).toEqual(kickBursts(1, n, screen, () => 0.5));
    }
  });
});
