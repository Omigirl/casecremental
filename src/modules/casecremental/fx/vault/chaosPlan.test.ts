import { describe, expect, it } from "vitest";
import { chaosLevels, flashTimes, kickPulse, type ChaosLevels } from "./chaosPlan";
import { VAULT_CUES } from "./cues";

const CHANNELS: (keyof ChaosLevels)[] = ["shake", "zoom", "hue", "rain", "sparks", "wobble", "background"];
const sweep = (from: number, to: number, step = 0.01): number[] => {
  const out: number[] = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(t);
  return out;
};

describe("the chaos plan", () => {
  it("is still before 0.9", () => {
    for (const t of [-1, 0, 0.3, 0.6, 0.89]) for (const ch of CHANNELS) expect(chaosLevels(t)[ch], `${ch} at ${t}`).toBe(0);
  });

  it("runs high in the shake, the rain and the sparks from the spin to the celebration", () => {
    for (const t of sweep(2.5, 9))
      for (const ch of ["shake", "rain", "sparks"] as const) expect(chaosLevels(t)[ch], `${ch} at ${t}`).toBeGreaterThanOrEqual(0.7);
  });

  it("eases off to 0.3 or less by 13", () => {
    for (const t of sweep(13, 14.5, 0.1)) for (const ch of CHANNELS) expect(chaosLevels(t)[ch], `${ch} at ${t}`).toBeLessThanOrEqual(0.3);
    expect(chaosLevels(11).shake).toBeLessThan(chaosLevels(8).shake);
  });

  it("stays within 0-1 on every channel", () => {
    for (const t of sweep(-1, 15, 0.037))
      for (const ch of CHANNELS) {
        expect(chaosLevels(t)[ch]).toBeGreaterThanOrEqual(0);
        expect(chaosLevels(t)[ch]).toBeLessThanOrEqual(1);
      }
  });

  it("is a function of t alone (a reload lands on the same chaos)", () => {
    const ts = [0.95, 1.2, 3.33, 6.01, 9.4, 12.7, 3.33, 0.95, 12.7];
    const first = ts.map((t) => chaosLevels(t));
    const again = ts.map((t) => chaosLevels(t));
    expect(again).toEqual(first);
    expect(chaosLevels(3.33)).toEqual(chaosLevels(3.33));
  });
});

describe("the kick's zoom punch", () => {
  it("hits 1 on every kick and dies away before the next", () => {
    for (const at of VAULT_CUES.fireworks) {
      expect(kickPulse(at + 1e-6), `kick ${at}`).toBeCloseTo(1, 3);
      expect(kickPulse(at + 0.34), `after kick ${at}`).toBeLessThan(0.1);
    }
    expect(kickPulse(0.99)).toBe(0);
    expect(kickPulse(14)).toBe(0);
  });
});

describe("the full-screen flashes (photosensitivity)", () => {
  it("never puts more than 3 in any 1-second window", () => {
    const all = flashTimes(-1, 20);
    expect(all.length).toBeGreaterThan(0);
    for (const from of sweep(-1, 15, 0.01))
      expect(flashTimes(from - 1e-9, from + 1).length, `[${from}, ${from + 1}]`).toBeLessThanOrEqual(3);
  });

  it("flashes on the impact and only on kicks, sorted", () => {
    const all = flashTimes(-1, 20);
    expect(all[0]).toBe(VAULT_CUES.impact);
    expect([...all].sort((a, b) => a - b)).toEqual(all);
    for (const at of all) expect(VAULT_CUES.fireworks).toContain(at);
  });

  it("lists the flashes after `from` up to and including `to`", () => {
    expect(flashTimes(0.98, 1.0)).toEqual([1.0]);
    expect(flashTimes(1.0, 1.01)).toEqual([]);
    expect(flashTimes(5, 5)).toEqual([]);
  });
});
