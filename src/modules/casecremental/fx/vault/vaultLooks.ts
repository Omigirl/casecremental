import type { VaultDef } from "../../sim/content/vaults";
import type { FanfareId } from "../audio/sounds";

// How each vault looks and sounds (spec M3 §7): the same last-chance ticket on the same 17.4 s timeline,
// parametrised by the run's VaultDef — the chest's art, the beams' colours, the light's tints, the fanfare and how
// dense the chaos is. Each vault is wilder than the last through count and density only: more firework bursts on
// the same kicks, twin items on the beams' streams, more rain and edge sparks; The Last Case (Run 4) is the densest and
// the only `finale`. Nothing here can touch the flash schedule (chaosPlan FLASHES, from VAULT_CUES.fireworks) or the
// beat-throb amplitudes (beat.ts BEAT_LIGHT_AMPLITUDES): those are the photosensitivity limits, the same for every
// vault. Vault I's entry is exactly the look it had before M3.

export type VaultId = VaultDef["id"];

/** The vault's light: colours only (each light's alpha and throb are global). */
export interface VaultLight {
  /** The impact's full-screen flash (pale: never a saturated red). */
  impactFlash: number;
  /** The rotating starburst once the lid is open, the impact's vertical shaft, the soft glow behind the beams. */
  starburst: number;
  shaft: number;
  glow: number;
  /** The chest: its glow while it trembles in the intro, the seam's line, its glow and inner light once open. */
  tremble: number;
  seam: number;
  open: number;
}

/** How wild the vault's chaos is: counts and densities against Vault I's, nothing else. */
export interface VaultChaosLook {
  /** Firework bursts on each kick (VAULT_CUES.fireworks keeps its 14 kicks, their sound and their flashes). */
  burstsPerKick: number;
  /** Items per slot on a beam's stream: 1 is one an item, 2 gives every item a twin half a step out (beamStream). */
  stream: number;
  /** Rain sprites and edge sparks, × Vault I's (96 and 2 × 22). */
  rain: number;
  sparks: number;
  /** The beams' shimmer: a tint swinging over hues from..from+span (turns), at this saturation at full chaos. */
  shimmer: { from: number; span: number; sat: number };
}

export interface VaultLook {
  id: VaultId;
  /** The chest's sprite sheet: 4 frames of VAULT_FRAME (closed, seam lit, snapping, open). */
  chest: string;
  /** The five beams' colours, left to right (symmetric). */
  palette: readonly [number, number, number, number, number];
  light: VaultLight;
  fanfare: FanfareId;
  chaos: VaultChaosLook;
  /** The grand ending (The Last Case): the screen tears at the impact and every reel spins until the lid opens (Finale.ts). */
  finale: boolean;
}

/** The densest any vault gets (× Vault I): The Last Case's; the chaos's and the beams' pools are sized for it once. */
export const MAX_DENSITY = 2.5;

export const VAULT_LOOKS: Readonly<Record<VaultId, VaultLook>> = {
  vault1: {
    id: "vault1",
    chest: "vault-case",
    palette: [0xffd23c, 0xff8a1e, 0xe8362a, 0xff8a1e, 0xffd23c], // yellow, orange, red, orange, yellow
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
    finale: false,
  },
  vault2: {
    id: "vault2",
    chest: "vault-case-2", // chrome with neon seams
    palette: [0x3ce8ff, 0xff3cd2, 0x8a3cff, 0xff3cd2, 0x3ce8ff], // cyan, magenta, violet, magenta, cyan
    light: {
      impactFlash: 0xe8fbff,
      starburst: 0xd8b0ff,
      shaft: 0xe8fbff,
      glow: 0x7ff7ff,
      tremble: 0xff6ae6,
      seam: 0x7ff7ff,
      open: 0xff6ae6,
    },
    fanfare: "vault-fanfare-2",
    chaos: { burstsPerKick: 3, stream: 1.5, rain: 1.5, sparks: 1.5, shimmer: { from: 0.78, span: 0.1, sat: 0.3 } },
    finale: false,
  },
  vault3: {
    id: "vault3",
    chest: "vault-case-3", // obsidian with molten seams
    palette: [0xfff0b0, 0xff8a1e, 0x3c7bff, 0xff8a1e, 0xfff0b0], // white-gold, orange, blue, orange, white-gold
    light: {
      impactFlash: 0xfff8e0,
      starburst: 0xfff0c0,
      shaft: 0xffffff,
      glow: 0xffa040,
      tremble: 0xff6a00,
      seam: 0xff8a1e,
      open: 0xffb347,
    },
    fanfare: "vault-fanfare-3",
    chaos: { burstsPerKick: 4, stream: 2, rain: 2, sparks: 2, shimmer: { from: 0.08, span: 0.05, sat: 0.2 } },
    finale: false,
  },
  lastcase: {
    id: "lastcase",
    chest: "vault-case-4", // black glass with gold glitch seams
    palette: [0xffffff, 0xffd34d, 0x1a0f2e, 0xffd34d, 0xffffff], // white, gold, void, gold, white
    light: {
      impactFlash: 0xfffbe8,
      starburst: 0xfff4c8,
      shaft: 0xffffff,
      glow: 0xffd34d,
      tremble: 0xffe08a,
      seam: 0xffd34d,
      open: 0xfff0b0,
    },
    fanfare: "vault-fanfare-4",
    // the densest of all: x2.5 Vault I's fireworks, rain and sparks; twins on every item (the beams' spacing rule's most)
    chaos: { burstsPerKick: 5, stream: 2, rain: 2.5, sparks: 2.5, shimmer: { from: 0.12, span: 0.04, sat: 0.15 } },
    finale: true,
  },
};

export const vaultLook = (id: VaultId): VaultLook => VAULT_LOOKS[id];
