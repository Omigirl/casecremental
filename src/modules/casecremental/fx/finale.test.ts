import { describe, expect, it } from "vitest";
import { FINALE_SILENCE_AT, finaleKnobs } from "./finale";

describe("the vault finale's schedule", () => {
  it("builds to everything at once, then falls silent before the vault opens", () => {
    const early = finaleKnobs(0.1);
    const late = finaleKnobs(0.8);
    expect(early.phase).toBe("build");
    expect(late.intensity).toBeGreaterThan(early.intensity);
    expect(late.rainPerSecond).toBeGreaterThan(early.rainPerSecond);
    expect(late.flashEvery).toBeLessThan(early.flashEvery);
    expect(finaleKnobs(FINALE_SILENCE_AT).phase).toBe("silence");
    expect(finaleKnobs(1.4)).toMatchObject({ phase: "silence", rainPerSecond: 0, shakePerSecond: 0 });
  });
});
