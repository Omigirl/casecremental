import { describe, expect, it } from "vitest";
import { Shake } from "./shake";

describe("Shake", () => {
  it("does nothing without trauma", () => {
    const s = new Shake(() => 1);
    const o = s.update(0.016);
    expect(Math.abs(o.x)).toBe(0);
    expect(Math.abs(o.y)).toBe(0);
  });

  it("offsets by maxOffset × trauma², then decays to rest", () => {
    const s = new Shake(() => 1, 18, 1.6);
    s.add(0.5);
    expect(s.update(0).x).toBeCloseTo(4.5);
    s.update(1); // this frame still uses the old trauma, then decays it to 0
    expect(Math.abs(s.update(0).x)).toBe(0);
    expect(s.level).toBe(0);
  });

  it("caps trauma at 1", () => {
    const s = new Shake(() => 1);
    s.add(5);
    expect(s.level).toBe(1);
  });
});
