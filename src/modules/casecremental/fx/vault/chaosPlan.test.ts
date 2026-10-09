import { describe, expect, it } from "vitest";
import { beatPulse } from "./beat";
import { chaosBeat, chaosLevels, flashTimes, introPunch, kickPulse, type ChaosLevels } from "./chaosPlan";
import { INTRO_HITS, INTRO_PAUSE, VAULT_CUES } from "./cues";

const CHANNELS: (keyof ChaosLevels)[] = ["shake", "zoom", "hue", "rain", "sparks", "wobble", "background"];
const sweep = (from: number, to: number, step = 0.01): number[] => {
  const out: number[] = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(t);
  return out;
};

describe("the chaos plan", () => {
  it("is still through the intro, before the impact", () => {
    for (const t of [-1, 0, 0.45, 1.6, 2.0, 3.3, 3.39]) for (const ch of CHANNELS) expect(chaosLevels(t)[ch], `${ch} at ${t}`).toBe(0);
  });

  it("runs high in the shake, the rain and the sparks from the spin to the celebration", () => {
    for (const t of sweep(4.9, 11.4))
      for (const ch of ["shake", "rain", "sparks"] as const) expect(chaosLevels(t)[ch], `${ch} at ${t}`).toBeGreaterThanOrEqual(0.7);
  });

  it("eases off to 0.3 or less by 15.4, through the fanfare's ring-out", () => {
    for (const t of sweep(15.4, 17.4, 0.1)) for (const ch of CHANNELS) expect(chaosLevels(t)[ch], `${ch} at ${t}`).toBeLessThanOrEqual(0.3);
    expect(chaosLevels(13.4).shake).toBeLessThan(chaosLevels(10.4).shake);
  });

  it("stays within 0-1 on every channel", () => {
    for (const t of sweep(-1, 18, 0.037))
      for (const ch of CHANNELS) {
        expect(chaosLevels(t)[ch]).toBeGreaterThanOrEqual(0);
        expect(chaosLevels(t)[ch]).toBeLessThanOrEqual(1);
      }
  });

  it("is a function of t alone (a reload lands on the same chaos)", () => {
    const ts = [3.35, 3.6, 5.73, 8.41, 11.8, 15.1, 5.73, 3.35, 15.1];
    const first = ts.map((t) => chaosLevels(t));
    const again = ts.map((t) => chaosLevels(t));
    expect(again).toEqual(first);
    expect(chaosLevels(5.73)).toEqual(chaosLevels(5.73));
  });
});

describe("the kick's zoom punch", () => {
  it("hits 1 on every kick and dies away before the next", () => {
    for (const at of VAULT_CUES.fireworks) {
      expect(kickPulse(at + 1e-6), `kick ${at}`).toBeCloseTo(1, 3);
      expect(kickPulse(at + 0.34), `after kick ${at}`).toBeLessThan(0.1);
    }
    expect(kickPulse(VAULT_CUES.impact - 0.01)).toBe(0);
    expect(kickPulse(16.4)).toBe(0);
  });
});

describe("the full-screen flashes (photosensitivity)", () => {
  it("never puts more than 3 in any 1-second window", () => {
    const all = flashTimes(-1, 20);
    expect(all.length).toBeGreaterThan(0);
    for (const from of sweep(-1, 18, 0.01))
      expect(flashTimes(from - 1e-9, from + 1).length, `[${from}, ${from + 1}]`).toBeLessThanOrEqual(3);
  });

  it("flashes once in the intro, on the run-up's last hit; then on the impact and only on kicks, sorted", () => {
    const all = flashTimes(-1, 20);
    const last = INTRO_HITS[INTRO_HITS.length - 1]!;
    expect(last.kind).toBe("run");
    expect(all.slice(0, 2)).toEqual([last.at, VAULT_CUES.impact]);
    expect(flashTimes(-1, VAULT_CUES.impact - 0.01)).toEqual([last.at]); // the build and the rest of the run-up: no flash
    expect([...all].sort((a, b) => a - b)).toEqual(all);
    for (const at of all.slice(1)) expect(VAULT_CUES.fireworks).toContain(at);
  });

  it("lists the flashes after `from` up to and including `to`", () => {
    expect(flashTimes(3.38, 3.4)).toEqual([3.4]);
    expect(flashTimes(3.4, 3.41)).toEqual([]);
    expect(flashTimes(3.2, 3.3)).toEqual([3.3]);
    expect(flashTimes(5, 5)).toEqual([]);
  });
});

describe("the chaos's beat", () => {
  it("is the drop's beat at the chaos's strength, a function of t alone (the chest reads this frame's)", () => {
    for (let t = -1; t <= 18; t += 0.017) {
      const b = chaosBeat(t);
      expect(b, `at ${t}`).toBeCloseTo(beatPulse(t) * chaosLevels(t).shake, 12);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
    expect(chaosBeat(VAULT_CUES.impact - 0.01)).toBe(0);
    expect(chaosBeat(VAULT_CUES.impact + 1e-6)).toBeGreaterThan(0.7);
  });
});

describe("the intro's zoom punch", () => {
  it("punches in on each run-up hit only, dying away before the next", () => {
    for (const h of INTRO_HITS) {
      const p = introPunch(h.at + 1e-6);
      if (h.kind === "run") expect(p, `run hit ${h.at}`).toBeCloseTo(1, 3);
      else expect(p, `build hit ${h.at}`).toBe(0);
      expect(introPunch(h.at + 0.29), `after ${h.at}`).toBe(0);
    }
  });

  it("is still in the pause and gone from the impact on", () => {
    for (const t of sweep(INTRO_PAUSE.from, INTRO_PAUSE.to - 0.01)) expect(introPunch(t), `${t}`).toBe(0);
    for (const t of sweep(VAULT_CUES.impact, 18, 0.05)) expect(introPunch(t), `${t}`).toBe(0);
    for (const t of sweep(-1, 18, 0.013)) {
      expect(introPunch(t)).toBeGreaterThanOrEqual(0);
      expect(introPunch(t)).toBeLessThanOrEqual(1);
    }
  });
});
