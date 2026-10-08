import { describe, expect, it } from "vitest";
import { Blinker } from "./blink";

describe("Blinker", () => {
  it("waits 2–5 s, then blinks half → closed → half and waits again", () => {
    const b = new Blinker(() => 0); // 2 s wait
    expect(b.update(1999)).toBeNull();
    expect(b.update(1)).toBe("half");
    expect(b.update(40)).toBe("closed");
    expect(b.update(70)).toBe("half");
    expect(b.update(40)).toBeNull();
    expect(b.update(1000)).toBeNull();
  });

  it("never waits longer than 5 s", () => {
    const b = new Blinker(() => 0.999);
    expect(b.update(5000)).toBe("half");
  });
});
