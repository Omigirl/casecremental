import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { cloutFor, perkCost } from "../src/modules/casecremental/sim/meta";
import { maxPlausibleLog10, scoreFor } from "../src/modules/casecremental/meta/plausibility";
import { fakeIo, loadCloud, type FakeIo } from "./load";

const DATA = JSON.parse(readFileSync(new URL("./data.json", import.meta.url), "utf8"));
const { RULES, handlers, makeIo } = loadCloud();
let p: FakeIo;
beforeEach(() => (p = fakeIo()));
const meta = () => p.st.data.ReadOnly!.cc_meta as any;
const end = (over: Record<string, unknown> = {}) =>
  RULES.endRun!(p.io, { runId: "r1", lifetimeEarnings: 1.2e6, elapsedSec: 480, endedAt: p.st.t, finaleReached: true, trophy: "vault1", ...over });

describe("loadMeta", () => {
  it("answers a fresh player and remembers when it first saw them", () => {
    expect(RULES.loadMeta!(p.io, {})).toMatchObject({ ok: true, clout: 0, trophies: [], loops: 0, perks: { startCash: 0 } });
    expect((p.st.data.Internal!.cc_anti as any).firstSeen).toBe(p.st.t);
  });
});

describe("endRun", () => {
  it("pays the client's CLOUT rule, grants the vault legend, counts the loop and scores the run", () => {
    const r = end();
    expect(r).toMatchObject({ ok: true, gained: cloutFor(1.2e6), clout: cloutFor(1.2e6), loops: 1, score: scoreFor(1.2e6), capped: false });
    expect(p.st.owned).toEqual(["vault1_legend"]);
    expect(meta().stats.cloutEarned).toBe(cloutFor(1.2e6));
  });

  it("caps an implausible run and says so", () => {
    const r = end({ lifetimeEarnings: 1e40 });
    expect(r.capped).toBe(true);
    expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(480, 0)));
  });

  it("never pays more than maxCloutPerRun", () => {
    const r = end({ lifetimeEarnings: 1e300, elapsedSec: DATA.firstRunMaxSec });
    expect(r.gained).toBe(DATA.maxCloutPerRun);
  });

  it("pays a replayed endRun once", () => {
    end();
    const again = end();
    expect(again).toMatchObject({ ok: true, duplicate: true, loops: 1 });
    expect(p.st.clout).toBe(cloutFor(1.2e6));
  });

  it("two queued runs replayed back to back are both paid", () => {
    end({ runId: "ra", endedAt: p.st.t - 600, elapsedSec: 480 });
    const r = end({ runId: "rb", endedAt: p.st.t, elapsedSec: 500, trophy: "vault2", lifetimeEarnings: 2e9 });
    expect(r.capped).toBe(false);
    expect(r.loops).toBe(2);
  });

  it("bounds the claimed time by the time since the last run ended", () => {
    end({ runId: "ra" });
    p.st.t += 60;
    const r = end({ runId: "rb", elapsedSec: 99999, trophy: "vault2", lifetimeEarnings: 1e30 });
    expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(60, 1)));
  });

  it("does not count a loop or grant a legend for the wrong vault", () => {
    const r = end({ trophy: "vault3" });
    expect(r.loops).toBe(0);
    expect(p.st.owned).toEqual([]);
  });

  it("gives every resource operation its own reason, the run's grant one tied to the run", () => {
    end();
    expect(p.st.ops.map((o) => o.reason)).toEqual(["endRun:U1:r1"]);
  });

  it("refuses a malformed report", () => {
    expect(end({ lifetimeEarnings: "lots" })).toMatchObject({ ok: false, retry: false });
    expect(end({ runId: "" })).toMatchObject({ ok: false });
  });
});

describe("reportTrophy", () => {
  it("grants a case trophy once", () => {
    expect(RULES.reportTrophy!(p.io, { skinId: "bc_knife", runId: "r1", elapsedSec: 100 })).toMatchObject({ ok: true, trophies: ["bc_knife"] });
    p.st.t += 10;
    RULES.reportTrophy!(p.io, { skinId: "bc_knife", runId: "r1", elapsedSec: 110 });
    expect(p.st.owned).toEqual(["bc_knife"]);
  });

  it("refuses a vault legend, an unknown skin and a case not reached yet", () => {
    expect(RULES.reportTrophy!(p.io, { skinId: "vault1_legend", runId: "r1", elapsedSec: 9 }).ok).toBe(false);
    expect(RULES.reportTrophy!(p.io, { skinId: "nope", runId: "r1", elapsedSec: 9 }).ok).toBe(false);
    const late = Object.entries(DATA.trophies).find(([, t]: any) => !t.vault && t.minLoops > 0)![0];
    expect(RULES.reportTrophy!(p.io, { skinId: late, runId: "r1", elapsedSec: 9 })).toMatchObject({ ok: false, retry: false });
  });

  it("grants a Run 4 case's trophy (a drop or an Upgrader win) once three vaults are opened", () => {
    const run4 = Object.entries(DATA.trophies).filter(([, t]: any) => !t.vault && t.minLoops === 3);
    expect(run4.map(([, t]: any) => t.source).sort()).toEqual(["feverdream", "feverdream", "feverdream", "glitch", "glitch", "glitch"]);
    const [skinId] = run4[0]!;
    expect(RULES.reportTrophy!(p.io, { skinId, runId: "r1", elapsedSec: 9 })).toMatchObject({ ok: false, retry: false });
    p.st.data.ReadOnly!.cc_meta = { v: 1, loops: 3 };
    expect(RULES.reportTrophy!(p.io, { skinId, runId: "r4", elapsedSec: 300 })).toMatchObject({ ok: true, trophies: [skinId] });
  });

  it("asks for a retry when reports come faster than one per 2 s", () => {
    RULES.reportTrophy!(p.io, { skinId: "bc_knife", runId: "r1", elapsedSec: 100 });
    expect(RULES.reportTrophy!(p.io, { skinId: "bc_warlord", runId: "r1", elapsedSec: 101 })).toMatchObject({ ok: false, retry: true });
  });
});

describe("buyPerk", () => {
  it("spends CLOUT at the client's price and raises the level", () => {
    p.st.clout = 100;
    const r = RULES.buyPerk!(p.io, { perkId: "luck", level: 0 });
    expect(r).toMatchObject({ ok: true, perks: { luck: 1 }, clout: 100 - perkCost("luck", 0)! });
  });

  it("a stale buyPerk is not bought twice", () => {
    p.st.clout = 100;
    RULES.buyPerk!(p.io, { perkId: "luck", level: 0 });
    const again = RULES.buyPerk!(p.io, { perkId: "luck", level: 0 });
    expect(again).toMatchObject({ ok: true, stale: true, perks: { luck: 1 } });
    expect(p.st.clout).toBe(100 - perkCost("luck", 0)!);
  });

  it("refuses without enough CLOUT, past max level, and refunds when the save fails", () => {
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: false, reason: "not enough CLOUT" });
    p.st.clout = 1e9;
    for (let lv = 0; perkCost("botAwake", lv) !== null; lv++) RULES.buyPerk!(p.io, { perkId: "botAwake", level: lv });
    expect(RULES.buyPerk!(p.io, { perkId: "botAwake" })).toMatchObject({ ok: false, reason: "max level" });
    const before = p.st.clout;
    p.st.failWrites = true;
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: false, retry: true });
    expect(p.st.clout).toBe(before);
    const reasons = p.st.ops.map((o) => o.reason);
    expect(new Set(reasons).size).toBe(reasons.length); // the refund never reuses the charge's reason
  });

  it("never puts a '.' in a Reason (a fractional clock made the platform refuse the consume)", () => {
    p.st.clout = 100;
    p.st.t = 1_000_000.375;
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 }).ok).toBe(true);
    for (const o of p.st.ops) expect(o.reason).not.toContain(".");
  });
});

describe("saveMeta", () => {
  it("keeps the larger stats, caps them by time, and checks the charm picks", () => {
    RULES.loadMeta!(p.io, {});
    p.st.t += 1000;
    const r = RULES.saveMeta!(p.io, { stats: { playSeconds: 900, opened: 5000, best: { skinId: "bc_knife", value: 1234 } }, picked: ["insider"] });
    expect(r.stats).toMatchObject({ playSeconds: 900, opened: 5000, best: { skinId: "bc_knife", value: 1234 } });
    expect(RULES.saveMeta!(p.io, { stats: { playSeconds: 1e9, opened: 1 } }).stats.playSeconds).toBeLessThanOrEqual(1000 + 3600);
    expect(RULES.saveMeta!(p.io, { stats: {}, picked: ["insider", "nope"] })).toMatchObject({ ok: false });
    expect(RULES.saveMeta!(p.io, { stats: {}, picked: ["insider", "fever"] })).toMatchObject({ ok: false }); // one charm slot
  });

  it("accepts picks alone (no campaign stats yet)", () => {
    expect(RULES.saveMeta!(p.io, { picked: ["insider"] })).toMatchObject({ ok: true, picked: ["insider"] });
  });
});

describe("handlers", () => {
  it("wrap the rules, turn a throw into a retryable refusal", () => {
    const thrower = {
      ReadUserData() {
        throw new Error("boom");
      },
      GetUserCustomData() {
        throw new Error("boom");
      },
    };
    const h = loadCloud(thrower).handlers;
    expect(h.loadMeta!({}, { UserID: "U1" })).toMatchObject({ ok: false, retry: true });
    expect(Object.keys(handlers).sort()).toEqual(["buyPerk", "endRun", "loadMeta", "reportTrophy", "saveMeta"]);
  });

  it("makeIo speaks the server shapes the probe confirmed", () => {
    const calls: unknown[][] = [];
    let customReads = 0;
    let invReads = 0;
    const server = {
      ReadUserData: (fields: unknown) => (
        invReads++,
        calls.push(["ReadUserData", fields]),
        { InventoryV2: { VirtualCurrencies: { CLOUT: { Amount: 7 } }, Items: { bc_knife: { TotalAmount: 1 }, x: { TotalAmount: 3 }, ww_knife: { TotalAmount: 0 } } } }
      ),
      GetUserCustomData: () => (customReads++, { Success: true, Data: { ReadOnly: { cc_meta: { Value: '{"loops":2}' } }, Internal: {} } }),
      SetUserCustomData: (...a: unknown[]) => (calls.push(["Set", ...a]), { Success: true }),
      ApplyResourceOperation: (q: unknown) => (calls.push(["Apply", q]), { Success: true }),
    };
    const io = makeIo(server, { UserID: "U1" });
    expect(io.clout()).toBe(7);
    expect(io.ownedTrophies()).toEqual(["bc_knife"]); // only Trophies ids that are owned
    expect(io.readData("ReadOnly", "cc_meta")).toEqual({ loops: 2 });
    expect(io.readData("Internal", "cc_anti")).toBeNull();
    expect(customReads).toBe(1); // one read per execution
    expect(io.writeData("ReadOnly", "cc_meta", { loops: 3 })).toBe(true);
    expect(io.readData("ReadOnly", "cc_meta")).toEqual({ loops: 3 }); // a write updates the cache
    expect(io.apply({ Grant: {} }, "why")).toBe(true);
    io.clout(); // inventory re-read after an operation
    expect(invReads).toBe(2);
    expect(calls).toContainEqual(["ReadUserData", ["InventoryV2"]]);
    expect(calls).toContainEqual(["Set", "ReadOnly", "cc_meta", '{"loops":3}']);
    expect(calls).toContainEqual(["Apply", { Operation: { Grant: {} }, Reason: "why" }]);
  });

  it("the committed bundle is data.json + casecremental.js (run `npm run cloud`)", () => {
    const dir = new URL("./", import.meta.url);
    const data = JSON.stringify(JSON.parse(readFileSync(new URL("data.json", dir), "utf8")));
    const code = readFileSync(new URL("casecremental.js", dir), "utf8");
    expect(readFileSync(new URL("casecremental.bundle.js", dir), "utf8")).toBe(
      `// Casecremental CloudCode — bundled by tools/cloud/bundle.mjs from cloudcode/data.json + cloudcode/casecremental.js.\nvar DATA = ${data};\n${code}`,
    );
  });
});
