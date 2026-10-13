import { describe, expect, it } from "vitest";
import { FlashGate } from "../hd/flashGate";
import { VAULT_CUES } from "./cues";
import { FINALE_INTRO_DIM, finaleDim, finaleSpin, TEAR_RESEEDS_PER_SECOND, TEAR_SECONDS, tearAt } from "./finaleRules";

const I = VAULT_CUES.impact;
const opening = (t: number) => ({ phase: "opening" as const, t, drops: [], landed: 0 });

describe("The Last Case's finale", () => {
  it("tears the screen from the impact for 1.5 s, fading out", () => {
    expect(tearAt(I - 0.01)).toBeNull();
    expect(tearAt(I)).toEqual({ strength: 1, slot: 0 });
    expect(tearAt(I + 0.75)!.strength).toBeGreaterThan(tearAt(I + 1.4)!.strength);
    expect(tearAt(I + TEAR_SECONDS)).toBeNull();
  });

  it("the tear reseeds at most 3 times a second and asks the gate (Review Focus 5)", () => {
    const slots = new Set<number>();
    for (let t = I; t < I + TEAR_SECONDS; t += 1 / 144) slots.add(tearAt(t)!.slot);
    expect(slots.size).toBeLessThanOrEqual(Math.ceil(TEAR_SECONDS * TEAR_RESEEDS_PER_SECOND));
    expect(TEAR_RESEEDS_PER_SECOND).toBeLessThanOrEqual(3);
    // in any one second, no more than 3 reseed windows start
    const starts = [...slots].map((s) => I + s / TEAR_RESEEDS_PER_SECOND);
    for (const from of starts) expect(starts.filter((x) => x >= from && x < from + 1).length).toBeLessThanOrEqual(3);
    // the impact's flash and two kicks take the gate: a reseed in that second is refused, and the slices hold
    const gate = new FlashGate();
    [0, 0.2, 0.4].forEach((t) => gate.take(t));
    expect(gate.take(0.5)).toBe(false);
  });

  it("the tear and the reels are functions of the vault's clock (Review Focus 2)", () => {
    expect(tearAt(I + 0.5)).toEqual(tearAt(I + 0.5));
    expect(finaleSpin(opening(1.2), true)).toEqual({ elapsed: 1.2, duration: I });
    expect(finaleSpin(opening(I), true)).toBeNull(); // the lid is open: they have landed
    expect(finaleSpin(opening(1.2), false)).toBeNull(); // only The Last Case
    expect(finaleSpin({ phase: "key" }, true)).toBeNull();
    expect(finaleSpin(null, true)).toBeNull();
  });

  it("lightens the dim while the reels spin, so they show", () => {
    expect(finaleDim(true, 1, 0.86)).toBe(FINALE_INTRO_DIM);
    expect(finaleDim(true, I, 0.86)).toBe(0.86);
    expect(finaleDim(false, 1, 0.86)).toBe(0.86);
  });
});
