import type { EyeState } from "./timeline";

// The code-drawn eyes (spec §6): 2×3 blocks on a dark 5×5 visor patch, in world pixels.

export const EYE_COLOR = 0x6fffe8;
export const VISOR_COLOR = 0x0d1418;

export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const visorPatch = (x: number, y: number): PxRect => ({ x: x - 2, y: y - 2, w: 5, h: 5 });

export function eyeRects(state: EyeState, x: number, y: number): PxRect[] {
  switch (state) {
    case "open":
      return [{ x: x - 1, y: y - 1, w: 2, h: 3 }];
    case "half":
      return [{ x: x - 1, y, w: 2, h: 2 }];
    case "closed":
      return [{ x: x - 1, y: y + 1, w: 3, h: 1 }];
    case "happy":
      return [
        { x: x - 1, y: y + 1, w: 1, h: 1 },
        { x, y, w: 1, h: 1 },
        { x: x + 1, y: y + 1, w: 1, h: 1 },
      ];
  }
}
