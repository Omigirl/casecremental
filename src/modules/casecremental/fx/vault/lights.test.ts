import { describe, expect, it } from "vitest";
import { BLACKOUT_SECONDS, blackoutLevel, LIGHTS_UP_SECONDS, lightCues, lightLevels } from "./lights";

describe("blackout and the lights coming back", () => {
  it("fades the scene smoothly to black", () => {
    expect(blackoutLevel(0)).toBe(1);
    expect(blackoutLevel(BLACKOUT_SECONDS)).toBe(0);
    let last = 1;
    for (let t = 0; t <= BLACKOUT_SECONDS; t += 0.05) {
      const v = blackoutLevel(t);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });

  it("brings the lights back one by one with flickers, ending fully lit (Review Focus 4)", () => {
    const at0 = lightLevels(0);
    expect(Object.values(at0).every((v) => v === 0)).toBe(true);
    const end = lightLevels(LIGHTS_UP_SECONDS);
    expect(Object.values(end).every((v) => v === 1)).toBe(true);
    // the lamp is first, the LEDs last
    const firstOn = (key: "lamp" | "reels" | "bin" | "leds") => {
      for (let t = 0; t <= LIGHTS_UP_SECONDS; t += 0.01) if (lightLevels(t)[key] > 0.5) return t;
      return Infinity;
    };
    expect(firstOn("lamp")).toBeLessThan(firstOn("reels"));
    expect(firstOn("reels")).toBeLessThan(firstOn("bin"));
    expect(firstOn("bin")).toBeLessThan(firstOn("leds"));
    // it flickers: the lamp goes off again at least once after first coming on
    let on = false;
    let flickered = false;
    for (let t = 0; t <= LIGHTS_UP_SECONDS; t += 0.01) {
      const v = lightLevels(t).lamp;
      if (v > 0.5) on = true;
      else if (on) flickered = true;
    }
    expect(flickered).toBe(true);
    expect(lightCues.length).toBeGreaterThanOrEqual(3);
  });
});

describe("the room light coming up", () => {
  const FRAME = 1 / 60;

  it("stays within 0-1", () => {
    for (let t = -1; t <= LIGHTS_UP_SECONDS + 1; t += 0.003) {
      expect(lightLevels(t).room, `at ${t}`).toBeGreaterThanOrEqual(0);
      expect(lightLevels(t).room, `at ${t}`).toBeLessThanOrEqual(1);
    }
  });

  it("flickers up rather than stepping: a frame never changes it by more than 0.05", () => {
    for (let t = 0; t <= LIGHTS_UP_SECONDS; t += 0.001) {
      const d = Math.abs(lightLevels(t + FRAME).room - lightLevels(t).room);
      expect(d, `from ${t.toFixed(3)}`).toBeLessThanOrEqual(0.05);
    }
  });

  it("still flickers: it dips at least once on its way up", () => {
    let peak = 0;
    let dipped = false;
    for (let t = 0; t <= LIGHTS_UP_SECONDS; t += 0.005) {
      const v = lightLevels(t).room;
      if (v < peak - 0.01) dipped = true;
      peak = Math.max(peak, v);
    }
    expect(dipped).toBe(true);
    expect(lightLevels(LIGHTS_UP_SECONDS).room).toBe(1);
  });
});
