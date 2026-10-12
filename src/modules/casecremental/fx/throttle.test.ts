import { describe, expect, it } from "vitest";
import { Throttle } from "./throttle";

describe("Throttle", () => {
  it("lets one through per gap, and starts over after a reset", () => {
    const th = new Throttle(0.25);
    expect(th.ready(0)).toBe(true);
    expect(th.ready(0.1)).toBe(false);
    expect(th.ready(0.25)).toBe(true);
    expect(th.ready(0.3)).toBe(false);
    th.reset();
    expect(th.ready(0.31)).toBe(true);
  });

  it("keeps a machine firing ten times a second to at most four sounds a second", () => {
    const th = new Throttle(0.25);
    let n = 0;
    for (let i = 0; i < 100; i++) if (th.ready(i / 10)) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(41);
  });
});
