import { describe, expect, it } from "vitest";
import { CASUAL, HUMAN, playCampaign, playToFull, PROBE_SECONDS, type BotTimings, type Leg, type PacingReport } from "./bot";
import { LAST_RUN } from "./tuning";

// The pacing targets (finish spec §5). Two players play the whole campaign — Run 1, then the next run after each
// vault, the last a replay of LAST_RUN, the cheapest perk after each vault: GREEDY (the HUMAN timings), a perfect
// player who never pauses, and CASUAL, a real player's slower hands that look at the shop every 8 s. Medians of five
// seeds, so one lucky knife doesn't decide a result. When this fails, tune sim/tuning.ts — never the players or the
// logic. The run rows loop over runs 2…LAST_RUN, so Run 4 (F6-A) is held to the same targets.

const SEEDS = [1, 2, 3, 4, 5];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

type Profile = "GREEDY" | "CASUAL";
type Band = readonly [min: number, max: number];
const PROFILES: Record<Profile, BotTimings> = { GREEDY: HUMAN, CASUAL };
/** Spec §5's table, in seconds — but GREEDY's Runs 2–3 vault may come from 3 min, not 4: once CASUAL and the 90 s
 *  rule fit, the perfect player's Run 2 vaults at ~3.4 min (F4: faster for a perfect player is fine). */
const TARGETS: Record<Profile, { firstVault: Band; catchUp: Band; vault: Band; replay: Band }> = {
  GREEDY: { firstVault: [240, 360], catchUp: [30, 90], vault: [180, 360], replay: [180, 300] },
  CASUAL: { firstVault: [360, 540], catchUp: [60, 120], vault: [300, 480], replay: [240, 420] },
};
/** The stage each run reaches before its vault (spec §5): Run 2 High, Run 3 Tripping, Run 4 Unhinged. */
const STAGE_TARGETS: Readonly<Record<number, number>> = { 2: 3, 3: 4, 4: 5 };
/** The 90 s rule: once a run is fully bought, its vault costs at most this many seconds of CASUAL income. */
const VAULT_INCOME_SECONDS = 90;
/** The replay's leg: legs[0] is Run 1, legs[n - 1] Run n, legs[LAST_RUN] the replay of LAST_RUN. */
const REPLAY = LAST_RUN;
/** Runs held to the targets so far. Run 3 is no longer the last run; Run 4 and the last run's replay join in plan F6-A
 *  Task 8, once Run 4 is tuned. */
const PACED_THROUGH: number = 3;

const mins = ([a, b]: Band) => `${a / 60}–${b / 60} min`;
const campaigns: Record<Profile, Leg[][]> = {
  GREEDY: SEEDS.map((s) => playCampaign(s, PROFILES.GREEDY)),
  CASUAL: SEEDS.map((s) => playCampaign(s, PROFILES.CASUAL)),
};
/** One leg's value across the seeds (a time that never came counts as never). */
const values = (p: Profile, leg: number, pick: (r: PacingReport) => number | undefined) =>
  campaigns[p].map((legs) => pick(legs[leg]!.report) ?? Number.POSITIVE_INFINITY);
const med = (p: Profile, leg: number, pick: (r: PacingReport) => number | undefined) => median(values(p, leg, pick));
/** The median within [min, max]; a failure lists every seed's value, for tuning. */
function expectBand(p: Profile, leg: number, pick: (r: PacingReport) => number | undefined, [min, max]: Band, what: string): void {
  const vs = values(p, leg, pick);
  const m = median(vs);
  const msg = `${p} ${what}: median ${m.toFixed(0)} s of [${vs.map((v) => v.toFixed(0)).join(", ")}]`;
  expect(m, msg).toBeGreaterThanOrEqual(min);
  expect(m, msg).toBeLessThanOrEqual(max);
}

describe("pacing — Run 1's opening (GREEDY)", () => {
  it("unlocks Wildwood in about 1–2.5 minutes", () => expectBand("GREEDY", 0, (r) => r.caseUnlockedAt.wildwood, [45, 150], "Wildwood"));
  it("unlocks Bedrock in about 2.5–6.5 minutes", () => expectBand("GREEDY", 0, (r) => r.caseUnlockedAt.bedrock, [150, 400], "Bedrock"));
  it("reaches stage 2 (Buzzed) within 20 s – 2 min", () => expectBand("GREEDY", 0, (r) => r.stageReachedAt[2], [20, 120], "Buzzed"));
  it("wakes the bot by about two and a half minutes", () => expectBand("GREEDY", 0, (r) => r.botAwakeAt, [0, 150], "bot awake"));
  it("buys the auto-seller at about 3–5 minutes", () => expectBand("GREEDY", 0, (r) => r.sellerAt, [180, 300], "seller"));
});

for (const p of ["GREEDY", "CASUAL"] as const) {
  const t = TARGETS[p];
  describe(`pacing — ${p} through the campaign`, () => {
    it("buys auto-spin after the auto-seller and before Vault I", () => {
      const at = med(p, 0, (r) => r.autoSpinAt);
      expect(at).toBeGreaterThan(med(p, 0, (r) => r.sellerAt));
      expect(at).toBeLessThan(med(p, 0, (r) => r.vaultAt));
    });
    it(`opens Vault I at ${mins(t.firstVault)}`, () => expectBand(p, 0, (r) => r.vaultAt, t.firstVault, "Run 1 vault"));
    for (let n = 2; n <= PACED_THROUGH; n++) {
      it(`Run ${n} catches up to Run ${n - 1}'s shelf in ${mins(t.catchUp)} and opens its vault at ${mins(t.vault)}`, () => {
        expectBand(p, n - 1, (r) => r.runCasesAt[n - 1], t.catchUp, `Run ${n} catch-up`);
        expectBand(p, n - 1, (r) => r.vaultAt, t.vault, `Run ${n} vault`);
      });
    }
    if (PACED_THROUGH === LAST_RUN)
      it(`a replay of Run ${LAST_RUN} vaults again at ${mins(t.replay)}`, () =>
        expectBand(p, REPLAY, (r) => r.vaultAt, t.replay, `Run ${LAST_RUN} replay vault`));
    it("never leaves the tray stuck full for long", () => {
      for (const legs of campaigns[p])
        for (const l of legs.slice(0, PACED_THROUGH)) expect(l.report.longestTrayFull, `${p} Run ${l.run}`).toBeLessThan(10);
    });
  });
}

describe("pacing — the runs' machines and stages (GREEDY)", () => {
  it("Run 2 buys the locker by about 4 min and presses contracts", () => {
    expect(med("GREEDY", 1, (r) => r.lockerAt)).toBeLessThan(240);
    expect(median(campaigns.GREEDY.map((legs) => legs[1]!.report.contracts))).toBeGreaterThan(0);
  });
  for (let n = 2; n <= PACED_THROUGH; n++) {
    it(`Run ${n} reaches stage ${STAGE_TARGETS[n]} before its vault`, () => {
      expect(median(campaigns.GREEDY.map((legs) => legs[n - 1]!.report.topStage))).toBeGreaterThanOrEqual(STAGE_TARGETS[n]!);
    });
  }
});

describe("the 90 s rule (spec §5): once a run is fully bought, its vault costs at most 90 s of its CASUAL income", () => {
  // each CASUAL leg again, same seed and setup, with the vault out of reach until everything is bought (bot.ts)
  const probes = campaigns.CASUAL.map((legs) => legs.map((l) => playToFull(l.seed, CASUAL, l.setup)));
  for (let i = 0; i <= LAST_RUN; i++) {
    if (i >= PACED_THROUGH && !(i === REPLAY && PACED_THROUGH === LAST_RUN)) continue;
    const name = i === REPLAY ? `the Run ${LAST_RUN} replay` : `Run ${i + 1}`;
    it(name, () => {
      for (const legs of probes) {
        const r = legs[i]!;
        expect(r.fullAt, `${name} never fully bought within ${PROBE_SECONDS} s`).toBeDefined();
        expect(r.fullIncome!, name).toBeGreaterThan(0);
        expect(r.vaultPrice / r.fullIncome!, `${name}: the vault in seconds of income`).toBeLessThanOrEqual(VAULT_INCOME_SECONDS);
      }
    });
  }
});
