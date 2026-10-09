import { describe, expect, it } from "vitest";
import { countUp } from "./countUp";
import { VAULT_INTRO_SECONDS, VAULT_LAND_TIMES } from "../../sim/tuning";
import { INTRO_HITS, INTRO_PAUSE, VAULT_CUES, vaultCues } from "./cues";

/** The opening before the intro (M2b-C7): the impact at 1.0; everything after it moves by the intro's +2.4 s. */
const SHIFT = 2.4;

describe("the jackpot opening's cues", () => {
  it("snaps the lid on the intro's end: the impact is VAULT_INTRO_SECONDS", () => {
    expect(VAULT_CUES.impact).toBe(VAULT_INTRO_SECONDS);
    expect(VAULT_CUES.impact).toBe(3.4);
  });

  it("moves every cue after the impact by +2.4 s", () => {
    const C = VAULT_CUES;
    expect(C.raysFrom).toBeCloseTo(1.5 + SHIFT, 9);
    expect(C.raysFull).toBeCloseTo(2.5 + SHIFT, 9);
    expect(C.columnsFrom).toBeCloseTo(1.5 + SHIFT, 9);
    expect(C.spinFrom).toBeCloseTo(2.5 + SHIFT, 9);
    expect(C.celebrateFrom).toBe(11.4);
    expect(C.celebrateTo).toBe(13.9);
  });

  it("walks the phases", () => {
    const at = (t: number) => vaultCues(t).phase;
    expect([0.5, 1.6, 3.35, 3.6, 4.4, 6.4, 9.4, 12.4, 14.4].map(at)).toEqual([
      "anticipation",
      "anticipation",
      "anticipation",
      "impact",
      "rays",
      "spin",
      "lockins",
      "celebrate",
      "hold",
    ]);
  });

  it("slams the lid open at the impact with an overshoot, settling at 1", () => {
    const { impact } = VAULT_CUES;
    expect(vaultCues(impact - 0.01).lid).toBe(0);
    expect(vaultCues(impact + 0.08).lid).toBeGreaterThan(1);
    expect(vaultCues(impact + 0.5).lid).toBe(1);
    expect(vaultCues(impact + 2).lid).toBe(1);
  });

  it("cascades the columns in 100 ms apart", () => {
    for (let i = 0; i < 5; i++) {
      const start = VAULT_CUES.columnsFrom + VAULT_CUES.columnStagger * i;
      expect(vaultCues(start - 0.01).columnIn[i]).toBe(0);
      expect(vaultCues(start + 0.25).columnIn[i]).toBe(1);
    }
  });

  it("holds the fan at full through the spin and softens it in the celebration", () => {
    for (const t of [5.4, 7.4, 10.4]) expect(vaultCues(t).rays).toBe(1);
    expect(vaultCues(14.4).rays).toBeLessThan(0.5);
    expect(vaultCues(3.8).rays).toBe(0);
  });

  it("kicks on the impact, every second of the spin, every lock-in and in a volley as the count-up starts", () => {
    const kicks = VAULT_CUES.fireworks;
    expect([...kicks]).toEqual([3.4, 4.9, 5.9, 6.9, 7.9, 8.4, 8.9, 9.4, 9.9, 10.9, 11.4, 11.75, 12.1, 12.45]);
    const before = [1.0, 2.5, 3.5, 4.5, 5.5, 6, 6.5, 7, 7.5, 8.5, 9.0, 9.35, 9.7, 10.05];
    kicks.forEach((at, i) => expect(at).toBeCloseTo(before[i]! + SHIFT, 9));
    expect([...kicks].sort((a, b) => a - b)).toEqual([...kicks]);
    for (const at of kicks) {
      expect(at).toBeGreaterThanOrEqual(VAULT_CUES.impact);
      expect(at).toBeLessThanOrEqual(VAULT_CUES.celebrateTo);
    }
    for (const at of VAULT_LAND_TIMES) expect(kicks).toContain(at);
    expect(kicks).toContain(VAULT_CUES.celebrateFrom);
  });

  it("pulses gold once at 11.4", () => {
    expect(vaultCues(11.3).pulse).toBe(0);
    expect(vaultCues(11.7).pulse).toBeGreaterThan(0.9);
    expect(vaultCues(12.4).pulse).toBe(0);
  });
});

describe("the intro's hits (before the impact)", () => {
  it("lists its eight kicks: three build hits, the held pause, then a five-hit run-up", () => {
    expect(INTRO_HITS.map((h) => h.at)).toEqual([0.45, 0.8, 1.15, 2.0, 2.3, 2.65, 2.95, 3.3]);
    expect(INTRO_HITS.map((h) => h.kind)).toEqual(["build", "build", "build", "run", "run", "run", "run", "run"]);
    expect(INTRO_PAUSE).toEqual({ from: 1.4, to: 1.95 });
    for (const h of INTRO_HITS) {
      expect(h.at < INTRO_PAUSE.from || h.at > INTRO_PAUSE.to, `${h.at}`).toBe(true);
      expect(h.at).toBeLessThan(VAULT_CUES.impact);
    }
  });

  it("stays in the anticipation, the lid shut, until the impact", () => {
    for (let t = 0; t < VAULT_CUES.impact; t += 0.01) {
      const c = vaultCues(t);
      expect(c.phase, `${t}`).toBe("anticipation");
      expect(c.lid, `${t}`).toBe(0);
    }
  });

  it("pulses a hit at each intro kick, dying away before the next", () => {
    for (const [i, h] of INTRO_HITS.entries()) {
      expect(vaultCues(h.at + 1e-6).hit, `hit ${i}`).toBeCloseTo(1, 3);
      expect(vaultCues(h.at - 1e-3).hit, `just before hit ${i}`).toBeLessThan(0.1);
      expect(vaultCues(h.at + 0.29).hit, `after hit ${i}`).toBe(0);
    }
    expect(vaultCues(0.3).hit).toBe(0);
    expect(vaultCues(VAULT_CUES.impact).hit).toBe(0);
    expect(vaultCues(5).hit).toBe(0);
  });

  it("trembles only on the hits, harder with each one, and the run-up harder than the build", () => {
    const peaks = INTRO_HITS.map((h) => vaultCues(h.at + 1e-6).tremble);
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]!, `hit ${i}`).toBeGreaterThan(peaks[i - 1]!);
    expect(peaks[7]).toBeCloseTo(1, 3);
    expect(peaks[0]).toBeGreaterThan(0.2);
    for (const t of [0, 0.3, 0.76, 1.12, 1.6, 1.9]) expect(vaultCues(t).tremble, `${t}`).toBe(0);
    expect(vaultCues(VAULT_CUES.impact).tremble).toBe(0);
  });

  it("holds dead still through the pause, the seam glowing steadily", () => {
    const seam = vaultCues(INTRO_PAUSE.from).seam;
    expect(seam).toBeGreaterThan(0.15); // lit
    for (let t = INTRO_PAUSE.from; t < INTRO_PAUSE.to; t += 0.01) {
      const c = vaultCues(t);
      expect(c.tremble, `${t}`).toBe(0);
      expect(c.hit, `${t}`).toBe(0);
      expect(c.seam, `${t}`).toBe(seam);
    }
  });

  it("widens the seam with each hit and flashes it on the hit", () => {
    expect(vaultCues(0.3).seam).toBeLessThanOrEqual(0.15); // still closed before the first
    // at rest after each hit (the last one's rest is the impact's open lid)
    const rest = INTRO_HITS.slice(0, -1).map((h) => vaultCues(h.at + 0.27).seam);
    for (let i = 1; i < rest.length; i++) expect(rest[i]!, `after hit ${i}`).toBeGreaterThan(rest[i - 1]!);
    for (const h of INTRO_HITS) expect(vaultCues(h.at + 1e-6).seam, `${h.at}`).toBeGreaterThan(vaultCues(h.at - 1e-3).seam);
    expect(vaultCues(VAULT_CUES.impact).seam).toBe(1);
  });
});

describe("countUp", () => {
  it("is 0 before 11.4, climbs, and rests on the total from 13.9", () => {
    expect(countUp(11.3, 1000)).toBe(0);
    const mid = countUp(12.4, 1000);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1000);
    expect(countUp(13.9, 1000)).toBe(1000);
    expect(countUp(16.4, 1000)).toBe(1000);
  });
});

describe("the cues' bounds", () => {
  it("keeps the seam's light, the hits, the tremble and the particle density within 0-1, before, through and after the opening", () => {
    for (let t = -2; t <= 20; t += 0.013) {
      const c = vaultCues(t);
      for (const [name, v] of [
        ["seam", c.seam],
        ["density", c.density],
        ["hit", c.hit],
        ["tremble", c.tremble],
      ] as const) {
        expect(v, `${name} at ${t}`).toBeGreaterThanOrEqual(0);
        expect(v, `${name} at ${t}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never counts the total down", () => {
    for (const total of [0, 1, 999.5, 1e15]) {
      let last = countUp(-1, total);
      for (let t = -1; t <= 20; t += 0.007) {
        const v = countUp(t, total);
        expect(v, `${total} at ${t}`).toBeGreaterThanOrEqual(last);
        last = v;
      }
      expect(last).toBe(total);
    }
  });
});
