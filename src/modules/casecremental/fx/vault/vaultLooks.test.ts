import { describe, expect, it } from "vitest";
import { VAULTS } from "../../sim/content/vaults";
import { VAULT_OPENING_SECONDS } from "../../sim/tuning";
import { BEAT_LIGHT_AMPLITUDES } from "./beat";
import { flashCrossed } from "./chaosPlan";
import { VAULT_FRAME } from "./vaultLayout";
import { MAX_DENSITY, VAULT_LOOKS, vaultLook, type VaultLook } from "./vaultLooks";

const LOOKS: VaultLook[] = VAULTS.map((v) => vaultLook(v.id));
const SPRITES = import.meta.glob("../../assets/sprites/vault-case*.json", { eager: true, import: "default" }) as Record<
  string,
  { frames: number; frameW: number; frameH: number }
>;
const isColour = (c: number) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe("the vaults' looks", () => {
  it("has one per vault, keyed by its id", () => {
    expect(Object.keys(VAULT_LOOKS).sort()).toEqual(VAULTS.map((v) => v.id).sort());
    for (const v of VAULTS) expect(vaultLook(v.id).id).toBe(v.id);
  });

  it("keeps Vault I exactly as it was before M3", () => {
    expect(vaultLook("vault1")).toEqual({
      id: "vault1",
      chest: "vault-case",
      palette: [0xffd23c, 0xff8a1e, 0xe8362a, 0xff8a1e, 0xffd23c],
      light: {
        impactFlash: 0xfff2c0,
        starburst: 0xffe08a,
        shaft: 0xfff2c0,
        glow: 0xffd34d,
        tremble: 0xffb040,
        seam: 0xffd34d,
        open: 0xffd34d,
      },
      fanfare: "vault-fanfare",
      chaos: { burstsPerKick: 2, stream: 1, rain: 1, sparks: 1, shimmer: { from: 0.02, span: 0.06, sat: 0.35 } },
    });
  });

  it("gives Vaults II and III their own chest, fanfare, beams and light", () => {
    expect(vaultLook("vault2")).toMatchObject({ chest: "vault-case-2", fanfare: "vault-fanfare-2" });
    expect(vaultLook("vault3")).toMatchObject({ chest: "vault-case-3", fanfare: "vault-fanfare-3" });
    expect(vaultLook("lastcase")).toMatchObject({ chest: "vault-case-4", fanfare: "vault-fanfare-4" });
    expect(new Set(LOOKS.map((l) => l.chest)).size).toBe(VAULTS.length);
    expect(new Set(LOOKS.map((l) => l.fanfare)).size).toBe(VAULTS.length);
    expect(new Set(LOOKS.map((l) => l.palette.join())).size).toBe(VAULTS.length);
    expect(new Set(LOOKS.map((l) => JSON.stringify(l.light))).size).toBe(VAULTS.length);
    for (const l of LOOKS) {
      expect(l.palette).toHaveLength(5);
      for (let i = 0; i < 5; i++) expect(l.palette[i], `${l.id} beam ${i}`).toBe(l.palette[4 - i]); // symmetric
      for (const c of [...l.palette, ...Object.values(l.light)]) expect(isColour(c), `${l.id} ${c.toString(16)}`).toBe(true);
    }
  });

  it("flashes pale, never saturated red, on every vault's impact", () => {
    for (const l of LOOKS) for (const ch of channels(l.light.impactFlash)) expect(ch, l.id).toBeGreaterThanOrEqual(0xc0);
  });

  it("gets wilder vault by vault through count and density only, within the pools' bound", () => {
    const [a, b, c] = LOOKS.map((l) => l.chaos);
    for (const k of ["burstsPerKick", "stream", "rain", "sparks"] as const) {
      expect(b![k], k).toBeGreaterThan(a![k]);
      expect(c![k], k).toBeGreaterThan(b![k]);
    }
    expect(b!.burstsPerKick / a!.burstsPerKick).toBeCloseTo(1.5, 9); // ×1.5 fireworks
    expect(c!.burstsPerKick / a!.burstsPerKick).toBeCloseTo(2, 9); // ×2 fireworks
    for (const l of LOOKS) {
      for (const k of ["stream", "rain", "sparks"] as const) expect(l.chaos[k], `${l.id} ${k}`).toBeLessThanOrEqual(MAX_DENSITY);
      expect(Number.isInteger(l.chaos.burstsPerKick)).toBe(true);
      expect(l.chaos.burstsPerKick).toBeLessThanOrEqual(2 * MAX_DENSITY);
    }
  });

  it("has a built 4-frame chest sheet the size of the vault's frame for every vault (lock, mouth and seam are frame px)", () => {
    for (const l of LOOKS) {
      const meta = SPRITES[`../../assets/sprites/${l.chest}.json`];
      expect(meta, l.chest).toBeDefined();
      expect(meta, l.chest).toMatchObject({ frames: VAULT_FRAME.frames, frameW: VAULT_FRAME.w, frameH: VAULT_FRAME.h });
    }
  });
});

describe("photosensitivity, for every vault (hard limits, the same for all)", () => {
  /** The full-screen flashes the scene fires frame by frame (VaultScene.show: at most one a frame, the last one
   *  crossed), at a steady `dt` or with a 0.25 s hitch every `hitchEvery` frames. */
  function flashesByFrame(dt: number, hitchEvery = 0): number[] {
    const out: number[] = [];
    let prev = -1e-6;
    for (let n = 1, t = 0; t <= VAULT_OPENING_SECONDS + 0.5; n++) {
      t = hitchEvery && n % hitchEvery === 0 ? t + 0.25 : t + dt;
      if (flashCrossed(prev, t) !== null) out.push(t);
      prev = t;
    }
    return out;
  }

  it.each(LOOKS.map((l) => [l.id, l] as const))(
    "%s: no look carries a flash, a kick or a throb — its chaos is counts and density only",
    (_, look) => {
      // a new knob here that could flash (a kick time, a flash, a light amplitude) must not be added: those are global
      expect(Object.keys(look.chaos).sort()).toEqual(["burstsPerKick", "rain", "shimmer", "sparks", "stream"]);
      expect(Object.keys(look.light).sort()).toEqual(["glow", "impactFlash", "open", "seam", "shaft", "starburst", "tremble"]);
    },
  );

  it.each(LOOKS.map((l) => [l.id] as const))(
    "%s: at most 3 full-screen flashes in any second, at any frame rate and through hitches",
    () => {
      for (const [dt, hitch] of [
        [1 / 30, 0],
        [1 / 60, 0],
        [1 / 144, 0],
        [1 / 60, 7],
      ] as const) {
        const f = flashesByFrame(dt, hitch);
        expect(f.length).toBeGreaterThan(0);
        for (const from of f) expect(f.filter((x) => x >= from && x < from + 1).length, `${dt} ${hitch} at ${from}`).toBeLessThanOrEqual(3);
      }
    },
  );

  it.each(LOOKS.map((l) => [l.id] as const))("%s: every light that throbs on the beat changes by less than 0.1", () => {
    // a tint only colours a light (each channel ≤ 1), so it never raises a throb above its alpha amplitude
    for (const [name, a] of Object.entries(BEAT_LIGHT_AMPLITUDES)) expect(a, name).toBeLessThan(0.1);
  });
});
