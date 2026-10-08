import { describe, expect, it } from "vitest";
import { Zoom } from "./zoom";

const run = (z: Zoom, seconds: number) => {
  let v = z.level;
  for (let t = 0; t < seconds; t += 1 / 60) v = z.update(1 / 60);
  return v;
};

describe("Zoom", () => {
  it("rests at exactly 1", () => {
    expect(run(new Zoom(), 1)).toBe(1);
  });

  it("snaps in, holds, then eases back to exactly 1", () => {
    const z = new Zoom();
    z.punch(1.3, 2);
    expect(run(z, 0.5)).toBeGreaterThan(1.28);
    expect(run(z, 1)).toBeGreaterThan(1.28);
    expect(run(z, 4)).toBe(1);
  });

  it("keeps the bigger of two punches", () => {
    const z = new Zoom();
    z.punch(1.3, 1);
    z.punch(1.08, 0.2);
    expect(run(z, 0.5)).toBeGreaterThan(1.25);
  });
});
