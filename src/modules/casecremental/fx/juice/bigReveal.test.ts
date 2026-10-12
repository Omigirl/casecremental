import { describe, expect, it } from "vitest";
import type { RarityId } from "../../sim/types";
import { bigReveal } from "./bigReveal";
import type { Juice } from "./juice";

// The bench's Covert/★ juice, moved out of BenchFx.revealed: the same calls, in the same order, as before.

function record(rarity: RarityId, zoom: boolean, opts?: { time?: boolean }): string[] {
  const calls: string[] = [];
  const log =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push(`${name}(${args.join(",")})`);
  const j = {
    hd: { flash: log("flash") },
    audio: { play: log("play"), duck: log("duck") },
    shake: { add: log("shake") },
    zoom: { punch: log("punch") },
    time: { hitStop: log("hitStop"), slowMo: log("slowMo") },
  } as unknown as Juice;
  bigReveal(j, rarity, zoom, opts);
  return calls;
}

describe("bigReveal", () => {
  it("plays the bench's juice for each rarity, as BenchFx.revealed did", () => {
    expect(record("milspec", true)).toEqual([]);
    expect(record("restricted", true)).toEqual([]);
    expect(record("classified", true)).toEqual(["shake(0.2)"]);
    expect(record("covert", true)).toEqual(["hitStop(0.08)", "punch(1.1,0.15)", "shake(0.55)", "play(covert-impact)", "duck(1.2)"]);
    expect(record("gold", true)).toEqual([
      "slowMo(0.2,2.2,0.7)",
      "punch(1.3,1.8)",
      "shake(0.8)",
      `flash(${0xffd700},0.7)`,
      "play(jackpot-swell)",
      "duck(2.6,0.2)",
    ]);
  });

  it("punches the camera in only when asked (away from your bench it stays put)", () => {
    expect(record("covert", false).some((c) => c.startsWith("punch"))).toBe(false);
    expect(record("gold", false).some((c) => c.startsWith("punch"))).toBe(false);
  });

  it("a machine's reveal (time: false) never hit-stops, slows time or ducks the music, but keeps the rest", () => {
    expect(record("classified", false, { time: false })).toEqual(["shake(0.2)"]);
    expect(record("covert", false, { time: false })).toEqual(["shake(0.55)", "play(covert-impact)"]);
    expect(record("gold", false, { time: false })).toEqual(["shake(0.8)", `flash(${0xffd700},0.7)`, "play(jackpot-swell)"]);
    for (const r of ["covert", "gold"] as const) {
      expect(record(r, true, { time: false }).some((c) => /^(hitStop|slowMo|duck)/.test(c))).toBe(false);
    }
  });
});
