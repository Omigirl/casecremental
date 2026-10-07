import { describe, expect, it } from "vitest";
import { playGreedy } from "./bot";

// Spec §9.6 targets for milestone 1's slice (cases 1–3). Median of five seeds so one lucky knife
// doesn't decide the result. When this fails, tune sim/tuning.ts — never the bot or the logic.

const SEEDS = [1, 2, 3, 4, 5];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe("pacing (greedy bot, human-speed actions)", () => {
  const reports = SEEDS.map((s) => playGreedy(s, 600));
  const at = (pick: (r: (typeof reports)[number]) => number | undefined) =>
    median(reports.map((r) => pick(r) ?? Number.POSITIVE_INFINITY));

  it("unlocks Wildwood in about 1–2.5 minutes", () => {
    const t = at((r) => r.caseUnlockedAt.wildwood);
    expect(t).toBeGreaterThan(45);
    expect(t).toBeLessThan(150);
  });

  it("unlocks Bedrock in about 2.5–6.5 minutes", () => {
    const t = at((r) => r.caseUnlockedAt.bedrock);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(400);
  });

  it("reaches stage 2 (Buzzed) within 20 s – 2 min", () => {
    const t = at((r) => r.stageReachedAt[2]);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(120);
  });
});
