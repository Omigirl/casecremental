// Stage 5's layers (Unhinged; finish spec §7.5, base spec §7): a warping screen, gold rain, glitch bursts and a
// strobe, as pure rules. They mix in only at stage 5 and never while the vault is out (it has its own show). The
// strobe and every glitch burst go through the flash gate (photosensitivity: at most 3 a second, shared with every
// other flash); the warp is motion only.

export const WARP_STRENGTH = 0.05;
const WARP_PERIOD = 6;
export const RAIN_MAX = 48;
export const STROBE_EVERY = 2;
export const STROBE_STRENGTH = 0.09;
export const GLITCH_GAP: readonly [number, number] = [3, 6];
export const GLITCH_SECONDS = 0.15;
/** The mix moves toward its target at this rate per second: a second in, a second out. */
const MIX_RATE = 1;

/** How much of stage 5's layers shows (0–1): toward 1 at stage 5 with no vault out, else toward 0. */
export function stageFiveMix(current: number, stage: number, vaultOut: boolean, dt: number): number {
  const step = MIX_RATE * dt;
  return stage >= 5 && !vaultOut ? Math.min(1, current + step) : Math.max(0, current - step);
}

/** The warp's bulge strength at the layer's clock `t`: a slow breath, scaled by the mix. */
export const warpAt = (t: number, mix: number): number => WARP_STRENGTH * mix * Math.sin((t / WARP_PERIOD) * Math.PI * 2);

/** Coins falling at once: twice the heat (reveals a second), capped, scaled by the mix. */
export const rainCount = (heat: number, mix: number): number => Math.round(Math.min(RAIN_MAX, Math.round(heat * 2)) * mix);

/** A strobe boundary (every STROBE_EVERY s of the layer's clock) was crossed between two frames. */
export const strobeDue = (prevT: number, t: number): boolean => Math.floor(t / STROBE_EVERY) > Math.floor(prevT / STROBE_EVERY);

/** When the next glitch burst is due, from a [0, 1) random draw. */
export const nextGlitchAt = (t: number, r: number): number => t + GLITCH_GAP[0] + (GLITCH_GAP[1] - GLITCH_GAP[0]) * r;
