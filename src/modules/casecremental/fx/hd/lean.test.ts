import { describe, expect, it } from "vitest";
import { Lean, MAX_LEAN } from "./lean";

describe("Lean", () => {
  it("tilts into a fast drag, never past the limit, and settles when it stops", () => {
    const l = new Lean();
    l.reset(0);
    let x = 0;
    let a = 0;
    for (let i = 0; i < 30; i++) a = l.update((x += 40), 1 / 60); // 2400 px/s to the right
    expect(a).toBeGreaterThan(0.2);
    expect(a).toBeLessThanOrEqual(MAX_LEAN);
    for (let i = 0; i < 60; i++) a = l.update(x, 1 / 60);
    expect(Math.abs(a)).toBeLessThan(0.01);
  });

  it("leans the other way when dragged left", () => {
    const l = new Lean();
    l.reset(500);
    let x = 500;
    let a = 0;
    for (let i = 0; i < 20; i++) a = l.update((x -= 20), 1 / 60);
    expect(a).toBeLessThan(0);
  });
});
