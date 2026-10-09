import { describe, expect, it } from "vitest";
import { barPulse, beatAt, beatPulse, VAULT_BPM, BEAT_LIGHT_AMPLITUDES } from "./beat";
import { VAULT_CUES } from "./cues";

const BEAT = 60 / VAULT_BPM;
const EPS = 1e-6;
const { impact } = VAULT_CUES;

describe("the fanfare's clock", () => {
  it("is the chiptune's 120 BPM counted from the impact", () => {
    expect(VAULT_BPM).toBe(120);
    expect(BEAT).toBe(0.5);
    expect(beatAt(impact)).toBeCloseTo(0, 9);
    expect(beatAt(impact + 0.5)).toBeCloseTo(1, 9);
    expect(beatAt(impact - 0.1)).toBeLessThan(0);
    expect(beatAt(0)).toBeLessThan(0);
  });

  it("pulses 1 just after each beat and has decayed by the next", () => {
    for (let n = 0; n < 26; n++) {
      const at = impact + n * BEAT;
      expect(beatPulse(at + EPS), `beat ${n}`).toBeCloseTo(1, 3);
      expect(beatPulse(at + BEAT - 0.02), `before beat ${n + 1}`).toBeLessThan(0.2);
    }
  });

  it("is silent through the intro, before the impact", () => {
    for (const t of [-1, 0, 0.45, 2.0, 3.3, impact - 0.01]) {
      expect(beatPulse(t)).toBe(0);
      expect(barPulse(t)).toBe(0);
    }
  });

  it("pulses bars every 4 beats", () => {
    for (let n = 0; n < 7; n++) {
      const at = impact + 4 * n * BEAT;
      expect(barPulse(at + EPS), `bar ${n}`).toBeCloseTo(1, 3);
      expect(barPulse(at + 4 * BEAT - 0.02), `before bar ${n + 1}`).toBeLessThan(0.2);
    }
    // the second beat of a bar is a beat, not a bar
    expect(barPulse(impact + BEAT + EPS)).toBeLessThan(0.8);
  });

  it("stays within 0-1", () => {
    for (let t = -1; t < 18; t += 0.013) {
      for (const v of [beatPulse(t), barPulse(t)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the beat throb and photosensitivity", () => {
  it("every light that throbs on the beat changes by less than 0.1 — under the flash threshold at any tempo", () => {
    const amps = Object.values(BEAT_LIGHT_AMPLITUDES);
    expect(amps.length).toBeGreaterThanOrEqual(3);
    for (const a of amps) expect(a).toBeLessThan(0.1);
  });
});
