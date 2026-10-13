import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

// large statistical samples: the default 5 s is too tight when the machine is loaded
const SLOW = 30_000;

describe("createRng", () => {
  it("is deterministic for a seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("differs between seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it(
    "stays in [0, 1) and averages near 0.5",
    () => {
      const r = createRng(7);
      let sum = 0;
      for (let i = 0; i < 100_000; i++) {
        const x = r.next();
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(1);
        sum += x;
      }
      expect(sum / 100_000).toBeCloseTo(0.5, 2);
    },
    SLOW,
  );

  it("int covers [min, max) only", () => {
    const r = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) seen.add(r.int(3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("pick refuses an empty list", () => {
    expect(() => createRng(1).pick([])).toThrow(/empty/);
  });

  it("resumes from a saved state exactly where it left off", () => {
    const a = createRng(7);
    for (let i = 0; i < 5; i++) a.next();
    const saved = a.state();
    const b = createRng(7, saved);
    expect([b.next(), b.next(), b.next()]).toEqual([a.next(), a.next(), a.next()]);
  });
});
