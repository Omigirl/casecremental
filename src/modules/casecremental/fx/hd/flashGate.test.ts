import { describe, expect, it } from "vitest";
import { FlashGate, MAX_FLASHES_PER_SECOND } from "./flashGate";

describe("FlashGate (photosensitivity: at most 3 full-screen flashes a second)", () => {
  it("lets a lone flash through", () => {
    expect(new FlashGate().take(5)).toBe(true);
  });

  it("never lets more than three start in any one second, however often they are asked for", () => {
    const g = new FlashGate();
    const starts: number[] = [];
    for (let i = 0; i < 600; i++) if (g.take(i / 60)) starts.push(i / 60); // asked every frame for 10 s
    expect(MAX_FLASHES_PER_SECOND).toBe(3);
    for (const t of starts) expect(starts.filter((u) => u >= t && u < t + 1).length).toBeLessThanOrEqual(3);
    expect(starts.length).toBeGreaterThan(20);
  });
});
