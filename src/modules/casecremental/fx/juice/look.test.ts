import { describe, expect, it } from "vitest";
import { bloomActive, lookFor } from "./look";

describe("stage look (review fix: no bloom cost while it is invisible)", () => {
  it("is muted without glow at stage 1 and saturated with glow from stage 2", () => {
    expect(lookFor(1)).toEqual({ saturation: -0.35, bloom: 0 });
    expect(lookFor(2)).toEqual({ saturation: 0.15, bloom: 0.9 });
  });

  it("switches the bloom pass off while its strength is ~0", () => {
    expect(bloomActive(0)).toBe(false);
    expect(bloomActive(0.005)).toBe(false);
    expect(bloomActive(0.2)).toBe(true);
  });
});
