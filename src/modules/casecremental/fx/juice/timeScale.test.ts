import { describe, expect, it } from "vitest";
import { TimeScale } from "./timeScale";

describe("TimeScale", () => {
  it("is 1 when nothing happens", () => {
    const t = new TimeScale();
    expect(t.update(0.016)).toBe(1);
    expect(t.active).toBe(false);
  });

  it("freezes for a hit-stop, then resumes", () => {
    const t = new TimeScale();
    t.hitStop(0.08);
    expect(t.update(0.05)).toBe(0);
    expect(t.update(0.05)).toBe(0);
    expect(t.update(0.05)).toBe(1);
  });

  it("slows down, ramps back, then ends", () => {
    const t = new TimeScale();
    t.slowMo(0.2, 2, 0.5);
    expect(t.update(0.1)).toBeCloseTo(0.2);
    expect(t.active).toBe(true);
    expect(t.update(1.6)).toBeCloseTo(0.52);
    expect(t.update(0.5)).toBe(1);
    expect(t.active).toBe(false);
  });

  it("lets a hit-stop win over slow-mo", () => {
    const t = new TimeScale();
    t.slowMo(0.2, 2, 0.5);
    t.hitStop(0.1);
    expect(t.update(0.05)).toBe(0);
  });
});
