import { describe, expect, it } from "vitest";
import { BEAT_LIGHT_AMPLITUDES } from "./beat";
import { VAULT_CUES } from "./cues";
import { raysLight } from "./rays";

const { impact, celebrateFrom } = VAULT_CUES;

describe("the light behind the beams", () => {
  it("charges the starburst up to the impact, with no shaft or glow yet", () => {
    expect(raysLight(0, 0, 0)).toEqual({ starburst: 0, shaft: 0, glow: 0 });
    const half = raysLight(impact / 2, 0, 0);
    expect(half.starburst).toBeCloseTo(0.05);
    expect(half.shaft).toBe(0);
    expect(half.glow).toBe(0);
  });

  it("drops the shaft at the impact and fades it out after 1.6 s", () => {
    expect(raysLight(impact, 0, 0).shaft).toBeCloseTo(0.95);
    expect(raysLight(impact + 0.8, 0, 0).shaft).toBeCloseTo(0.475);
    expect(raysLight(impact + 1.6, 0, 0).shaft).toBe(0);
  });

  it("follows the rays' strength while the beams spin", () => {
    const full = raysLight(5, 1, 0);
    expect(full.starburst).toBeCloseTo(0.42);
    expect(full.glow).toBeCloseTo(0.35);
  });

  it("softens the starburst and brightens the glow once the celebration has rested the rays", () => {
    const rested = raysLight(celebrateFrom + 3, 0.3, 0);
    expect(rested.starburst).toBeCloseTo(0.22);
    expect(rested.glow).toBeCloseTo(0.6);
  });

  it("pulses the starburst on the chaos's beat", () => {
    const on = raysLight(5, 1, 1).starburst - raysLight(5, 1, 0).starburst;
    expect(on).toBeCloseTo(BEAT_LIGHT_AMPLITUDES.starburst);
  });
});
