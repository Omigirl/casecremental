import type { PatternKind, PatternMotion } from "../../sim/types";

// Thirteen finishes for cases 4-7 (spec: M3 §3): Mainframe (circuit, hex, carbon), Neon Nights (synthgrid,
// neonline, hueflow), Deep Space (starfield, nebula, aurora, iridescent), Inferno (flame, ember, molten).
// Each is a richer technique than cases 1-3 (networks, perspective, domain warping, distance-based glow) and
// still a pure function of (palette, point[, phase]). Palettes run darkest first; glow is bright colours on
// dark ones with a soft falloff, and every pixel is one palette colour or a blend of two. They are tuned for
// the in-game skin (26 x 10 px) at scales 4-8: thin lines are kept at least one game pixel wide.

/** The motion each kind draws itself (traces lighting up, a grid rolling in, flames rising...): finishAt hands
 *  it the loop phase and lays nothing generic on top. Every one repeats at phase 1, so its loop has no seam. */
export const OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = {};
