import { describe, expect, it } from "vitest";
import { binLight, lampFlicker, makeMotes, stepMotes } from "./ambience";

describe("ambience", () => {
  it("keeps the lamp between 0.78 and 1 and actually flickers", () => {
    const samples = Array.from({ length: 4000 }, (_, i) => lampFlicker(i * 0.05));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.78);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.08);
  });

  it("keeps dust inside its box forever", () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const box = { x: 100, y: 50, w: 200, h: 120 };
    const motes = makeMotes(40, box, random);
    for (let i = 0; i < 3000; i++) stepMotes(motes, 1 / 30, box, i / 30);
    for (const m of motes) {
      expect(m.x).toBeGreaterThanOrEqual(box.x);
      expect(m.x).toBeLessThanOrEqual(box.x + box.w);
      expect(m.y).toBeGreaterThanOrEqual(box.y);
      expect(m.y).toBeLessThanOrEqual(box.y + box.h);
    }
  });

  it("keeps the sell bin findable, and calls for the card while one waits", () => {
    const idle = Array.from({ length: 400 }, (_, i) => binLight(false, i * 0.05));
    const calling = Array.from({ length: 400 }, (_, i) => binLight(true, i * 0.05));
    expect(Math.min(...idle)).toBeGreaterThanOrEqual(0.2); // a work light, always on
    expect(Math.max(...idle)).toBeLessThan(Math.min(...calling)); // waiting is always brighter
    expect(Math.max(...calling) - Math.min(...calling)).toBeGreaterThan(0.2); // and it pulses
    expect(Math.max(...calling)).toBeLessThanOrEqual(1);
  });
});
