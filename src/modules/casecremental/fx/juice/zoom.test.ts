import { describe, expect, it } from "vitest";
import { Zoom, zoomRestFor } from "./zoom";

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

  it("at stage 5 rests between push-ins, but a punch while pushed in still extends it (F9)", () => {
    expect([1, 2, 3, 4].map(zoomRestFor)).toEqual([0, 0, 0, 0]);
    const z = new Zoom();
    z.minRest = zoomRestFor(5);
    z.punch(1.3, 1.8); // a ★
    expect(run(z, 0.5)).toBeGreaterThan(1.28);
    z.punch(1.1, 0.15); // a Covert while pushed in: still part of this push-in
    expect(run(z, 4)).toBe(1);
    z.punch(1.3, 1.8); // the next ★ soon after the camera came back: refused
    expect(run(z, 0.5)).toBe(1);
    run(z, 7); // rested 8 s since it came back
    z.punch(1.3, 1.8);
    expect(run(z, 0.5)).toBeGreaterThan(1.28);
  });

  it("below stage 5 every punch zooms, back to back", () => {
    const z = new Zoom();
    z.punch(1.3, 1);
    expect(run(z, 4)).toBe(1);
    z.punch(1.3, 1);
    expect(run(z, 0.5)).toBeGreaterThan(1.28);
  });
});
