import { describe, expect, it } from "vitest";
import { RAIN_LIFE, stepRain, type RainDrop } from "./rain";

const drop = (): RainDrop => ({ x: 10, y: -20, floorY: 100, vy: 0, rot: 0, vr: 2, age: 0, landed: false });

describe("raining cases", () => {
  it("fall, spin and land on their floor", () => {
    let drops = [drop()];
    for (let i = 0; i < 60; i++) drops = stepRain(drops, 1 / 60, 900);
    const d = drops[0]!;
    expect(d.landed).toBe(true);
    expect(d.y).toBe(100);
    const rot = d.rot;
    drops = stepRain(drops, 0.1, 900);
    expect(drops[0]!.rot).toBe(rot); // a landed case stops turning
  });

  it("are gone after their life", () => {
    let drops = [drop()];
    drops = stepRain(drops, RAIN_LIFE + 0.01, 900);
    expect(drops).toHaveLength(0);
  });
});
