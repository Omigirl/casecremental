import { describe, expect, it } from "vitest";
import { FlashGate, MAX_FLASHES_PER_SECOND } from "../hd/flashGate";
import {
  GLITCH_GAP,
  nextGlitchAt,
  RAIN_MAX,
  rainCount,
  stageFiveMix,
  STROBE_EVERY,
  STROBE_STRENGTH,
  strobeDue,
  WARP_STRENGTH,
  warpAt,
} from "./stageFive";

describe("stage 5's layers", () => {
  it("come in only at stage 5, never while the vault is out, easing over about a second", () => {
    let m = 0;
    for (let i = 0; i < 15; i++) m = stageFiveMix(m, 5, false, 1 / 30);
    expect(m).toBeGreaterThan(0.4);
    expect(m).toBeLessThan(0.6);
    for (let i = 0; i < 60; i++) m = stageFiveMix(m, 5, false, 1 / 30);
    expect(m).toBeCloseTo(1, 2);
    expect(stageFiveMix(1, 5, true, 1)).toBe(0);
    expect(stageFiveMix(1, 4, false, 1)).toBe(0);
  });

  it("warps gently, rains by the heat up to its cap", () => {
    for (let t = 0; t < 12; t += 0.1) expect(Math.abs(warpAt(t, 1))).toBeLessThanOrEqual(WARP_STRENGTH);
    expect(warpAt(3, 0)).toBe(0);
    expect(rainCount(0, 1)).toBe(0);
    expect(rainCount(10, 1)).toBe(20);
    expect(rainCount(1000, 1)).toBe(RAIN_MAX);
    expect(rainCount(1000, 0.5)).toBe(RAIN_MAX / 2);
  });

  it("the strobe and the glitch bursts ask the flash gate (Review Focus 5)", () => {
    // the strobe fires on every STROBE_EVERY boundary crossed, once, and is a soft pulse, not a white-out
    let due = 0;
    for (let i = 1; i <= 600; i++) if (strobeDue((i - 1) / 60, i / 60)) due++; // ten seconds of 60 fps frames
    expect(due).toBe(Math.floor(10 / STROBE_EVERY));
    expect(STROBE_STRENGTH).toBeLessThanOrEqual(0.15);
    // glitch gaps stay in range
    for (const r of [0, 0.5, 0.999]) {
      const gap = nextGlitchAt(100, r) - 100;
      expect(gap).toBeGreaterThanOrEqual(GLITCH_GAP[0]);
      expect(gap).toBeLessThanOrEqual(GLITCH_GAP[1]);
    }
    // a ★ flash, a stage-up and a power-on in the same second as a strobe and a burst: the gate refuses the extra
    const gate = new FlashGate();
    const granted = [0, 0.1, 0.2, 0.3, 0.4].filter((t) => gate.take(t)).length;
    expect(granted).toBe(MAX_FLASHES_PER_SECOND);
  });
});
