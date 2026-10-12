import { describe, expect, it } from "vitest";
import { freshMeta, type MetaState } from "../sim/meta";
import type { ServerDoc } from "./bridge";
import { applyServerDoc, campaignStatsOf } from "./merge";

const doc = (over: Partial<ServerDoc> = {}): ServerDoc => ({
  clout: 40,
  trophies: ["vault1_legend", "bc_knife"],
  perks: { startCash: 2, luck: 1 },
  loops: 1,
  stats: { playSeconds: 900, opened: 800, best: null, cloutEarned: 50 },
  picked: [],
  ...over,
});

/** A meta with F6-A's campaign stats (MetaState.stats), however the type looks when this runs. */
const withStats = (): MetaState => Object.assign(freshMeta(), { stats: { playSeconds: 0, opened: 0, best: null, cloutEarned: 0 } });

describe("applyServerDoc", () => {
  it("takes the server's CLOUT and perks when nothing is pending", () => {
    const m = freshMeta();
    m.clout = 999;
    m.perks.luck = 3;
    applyServerDoc(m, doc(), false);
    expect(m.clout).toBe(40);
    expect(m.perks).toMatchObject({ startCash: 2, luck: 1 });
  });

  it("keeps the local CLOUT and the larger perks while writes are pending", () => {
    const m = freshMeta();
    m.clout = 12;
    m.perks.luck = 3;
    applyServerDoc(m, doc(), true);
    expect(m.clout).toBe(12);
    expect(m.perks).toMatchObject({ startCash: 2, luck: 3 });
  });

  it("a fresh local meta gets the server's loops, perks and vault trophies", () => {
    const m = freshMeta();
    applyServerDoc(m, doc(), false);
    expect(m.loops).toBe(1);
    expect(m.trophies).toEqual(["vault1"]);
    expect(m.perks.startCash).toBe(2);
  });

  it("never lowers the local loops, and keeps the local CLOUT and larger perks while the server is behind on them", () => {
    const m = freshMeta(); // e.g. a save from before F7: three vaults the server never saw
    m.loops = 3;
    m.clout = 120;
    m.perks.luck = 4;
    applyServerDoc(m, doc(), false);
    expect(m.loops).toBe(3);
    expect(m.clout).toBe(120);
    expect(m.perks).toMatchObject({ luck: 4, startCash: 2 });
  });

  it("grows the campaign stats when the meta has them (F6-A), and never lowers them", () => {
    const m = withStats();
    applyServerDoc(m, doc(), false);
    expect(campaignStatsOf(m)).toMatchObject({ playSeconds: 900, opened: 800, cloutEarned: 50 });
    campaignStatsOf(m)!.opened = 5000;
    applyServerDoc(m, doc(), false);
    expect(campaignStatsOf(m)!.opened).toBe(5000);
  });

  it("leaves a meta without campaign stats alone", () => {
    const m = freshMeta();
    applyServerDoc(m, doc(), false);
    expect(campaignStatsOf(m)).toBeNull();
    expect("stats" in m).toBe(false);
  });
});
