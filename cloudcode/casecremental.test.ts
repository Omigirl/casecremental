import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { cloutFor, perkCost } from "../src/modules/casecremental/sim/meta";
import { maxPlausibleLog10, minRunSeconds, scoreFor } from "../src/modules/casecremental/meta/plausibility";
import { fakeIo, loadCloud, type FakeIo } from "./load";

const DATA = JSON.parse(readFileSync(new URL("./data.json", import.meta.url), "utf8"));
const { RULES, handlers, makeIo } = loadCloud();
let p: FakeIo;
/** A player the server first saw (loadMeta) ten minutes ago. */
beforeEach(() => {
  p = fakeIo();
  RULES.loadMeta!(p.io, {});
  p.st.t += 600;
});
const meta = () => p.st.data.ReadOnly!.cc_meta as any;
const anti = () => p.st.data.Internal!.cc_anti as any;
const end = (over: Record<string, unknown> = {}) =>
  RULES.endRun!(p.io, { runId: "r1", lifetimeEarnings: 1.2e6, elapsedSec: 480, endedAgoSec: 0, finaleReached: true, trophy: "vault1", ...over });

describe("loadMeta", () => {
  it("answers a fresh player and remembers when it first saw them", () => {
    const q = fakeIo();
    expect(RULES.loadMeta!(q.io, {})).toMatchObject({ ok: true, clout: 0, trophies: [], loops: 0, perks: { startCash: 0 } });
    expect((q.st.data.Internal!.cc_anti as any).firstSeen).toBe(q.st.t);
  });
});

describe("endRun", () => {
  it("pays the client's CLOUT rule, grants the vault legend, counts the loop and scores the run", () => {
    const r = end();
    expect(r).toMatchObject({ ok: true, gained: cloutFor(1.2e6), clout: cloutFor(1.2e6), loops: 1, score: scoreFor(1.2e6), capped: false, finale: true });
    expect(p.st.owned).toEqual(["vault1_legend"]);
    expect(meta().stats.cloutEarned).toBe(cloutFor(1.2e6));
  });

  it("caps an implausible run and says so", () => {
    const r = end({ lifetimeEarnings: 1e40 });
    expect(r.capped).toBe(true);
    expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(480, 0)));
  });

  it("never pays more than maxCloutPerRun", () => {
    p.st.t += 1e9;
    const r = end({ lifetimeEarnings: 1e300, elapsedSec: 1e9 });
    expect(r.gained).toBe(DATA.maxCloutPerRun);
  });

  it("answers a replayed endRun with the run's own score and gain, and pays it once", () => {
    const first = end();
    const again = end();
    expect(again).toMatchObject({ ok: true, duplicate: true, loops: 1, score: first.score, gained: first.gained });
    expect(p.st.clout).toBe(cloutFor(1.2e6));
  });

  it("two queued runs replayed back to back are both paid", () => {
    p.st.t += 600;
    end({ runId: "ra", endedAgoSec: 600, elapsedSec: 480 });
    const r = end({ runId: "rb", endedAgoSec: 0, elapsedSec: 500, trophy: "vault2", lifetimeEarnings: 2e9 });
    expect(r.capped).toBe(false);
    expect(r.loops).toBe(2);
  });

  it("bounds the claimed time by the time since the last run ended", () => {
    end({ runId: "ra" });
    p.st.t += 60;
    const r = end({ runId: "rb", elapsedSec: 99999, trophy: "vault2", lifetimeEarnings: 1e30 });
    expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(60, 1)));
  });

  it("bounds a first run by the time since the server first saw the player, not by a fixed window", () => {
    const r = end({ elapsedSec: 99999, lifetimeEarnings: 1e30 });
    expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(600, 0)));
  });

  it("an endedAt of 0 (or a run that ended 'long ago') cannot reach before the last run or the first sight", () => {
    const old = RULES.endRun!(p.io, { runId: "r0", lifetimeEarnings: 1e30, elapsedSec: 99999, endedAt: 0, finaleReached: true, trophy: "vault1" });
    expect(old).toMatchObject({ ok: true, loops: 0, finale: false, gained: 0 }); // ended at the first sight: no time at all
    p.st.t += 300;
    const ago = end({ runId: "r2", endedAgoSec: 1e9, lifetimeEarnings: 1e30, elapsedSec: 99999 });
    expect(ago).toMatchObject({ loops: 0, finale: false, gained: 0 });
    expect(anti().lastEndAt).toBe(1_000_000); // the first sight, not the client's 0
  });

  it("does not count a vault before the expected one (and grants nothing for it)", () => {
    end({ runId: "ra" });
    p.st.t += 600;
    const r = end({ runId: "rb", trophy: "vault1" });
    expect(r).toMatchObject({ loops: 1, finale: false });
  });

  it("catches up after a lost endRun: a later vault counts when the time since the last counted one covers both", () => {
    // Run 1's endRun never arrived; Run 2 vaults 10 minutes later
    p.st.t += 600;
    const r = end({ runId: "r2", trophy: "vault2", lifetimeEarnings: 2e9, elapsedSec: 400 });
    expect(r).toMatchObject({ ok: true, finale: true, loops: 2, capped: false }); // capped as a Run 2, not a Run 1
    expect(p.st.owned).toEqual(["vault2_legend"]);
    // and the server keeps counting from there
    p.st.t += 600;
    expect(end({ runId: "r3", trophy: "vault3", lifetimeEarnings: 1e12, elapsedSec: 500 })).toMatchObject({ finale: true, loops: 3 });
  });

  it("refuses a fast scripted finale: a run under the minimum time, or a skip the clock cannot cover", () => {
    const fast = end({ elapsedSec: minRunSeconds(0) - 1 });
    expect(fast).toMatchObject({ ok: true, finale: false, loops: 0 });
    expect(p.st.owned).toEqual([]);
    const q = fakeIo();
    RULES.loadMeta!(q.io, {});
    q.st.t += DATA.minRunSec[3] + 1; // long enough for The Last Case alone, not for the three vaults before it
    const skip = RULES.endRun!(q.io, { runId: "x", lifetimeEarnings: 1e9, elapsedSec: 9999, endedAgoSec: 0, finaleReached: true, trophy: "lastcase" });
    expect(skip).toMatchObject({ finale: false, loops: 0 });
  });

  it("counts every replay of the last run with the replay minimum", () => {
    p.st.data.ReadOnly!.cc_meta = { v: 1, loops: DATA.vaults.length };
    p.st.data.Internal!.cc_anti = { firstSeen: p.st.t - 9999, lastEndAt: p.st.t - DATA.minReplaySec };
    expect(end({ runId: "rep", trophy: "lastcase", elapsedSec: DATA.minReplaySec })).toMatchObject({ finale: true, loops: DATA.vaults.length + 1 });
  });

  it("gives the run's grant one Reason tied to the run", () => {
    end();
    expect(p.st.ops.map((o) => o.reason)).toEqual(["endRun:U1:r1"]);
  });

  it("asks for a retry when the meta write fails, and the retry pays once", () => {
    p.st.failWrites = true;
    expect(end()).toMatchObject({ ok: false, retry: true });
    p.st.failWrites = false;
    expect(end()).toMatchObject({ ok: true, loops: 1 });
    expect(p.st.clout).toBe(cloutFor(1.2e6));
    expect(p.st.owned).toEqual(["vault1_legend"]);
  });

  it("reads a revision-9 meta (bare run ids)", () => {
    p.st.data.ReadOnly!.cc_meta = { v: 1, loops: 0, runs: ["r1"] };
    expect(end()).toMatchObject({ duplicate: true, score: 0 });
  });

  it("refuses a malformed report", () => {
    expect(end({ lifetimeEarnings: "lots" })).toMatchObject({ ok: false, retry: false });
    expect(end({ runId: "" })).toMatchObject({ ok: false });
  });
});

describe("reportTrophy", () => {
  it("grants a case trophy once", () => {
    expect(RULES.reportTrophy!(p.io, { skinId: "bc_knife" })).toMatchObject({ ok: true, trophies: ["bc_knife"] });
    p.st.t += 10;
    RULES.reportTrophy!(p.io, { skinId: "bc_knife" });
    expect(p.st.owned).toEqual(["bc_knife"]);
  });

  it("refuses a vault legend, an unknown skin, a prototype key and a case not reached yet", () => {
    for (const skinId of ["vault1_legend", "nope", "constructor", "__proto__", "toString"])
      expect(RULES.reportTrophy!(p.io, { skinId })).toMatchObject({ ok: false, retry: false });
    const late = Object.entries(DATA.trophies).find(([, t]: any) => !t.vault && t.minLoops > 0)![0];
    expect(RULES.reportTrophy!(p.io, { skinId: late })).toMatchObject({ ok: false, retry: false });
  });

  it("grants a Run 4 case's trophy (a drop or an Upgrader win) once three vaults are opened", () => {
    const run4 = Object.entries(DATA.trophies).filter(([, t]: any) => !t.vault && t.minLoops === 3);
    expect(run4.map(([, t]: any) => t.source).sort()).toEqual(["feverdream", "feverdream", "feverdream", "glitch", "glitch", "glitch"]);
    const [skinId] = run4[0]!;
    expect(RULES.reportTrophy!(p.io, { skinId })).toMatchObject({ ok: false, retry: false });
    p.st.data.ReadOnly!.cc_meta = { v: 1, loops: 3 };
    expect(RULES.reportTrophy!(p.io, { skinId })).toMatchObject({ ok: true, trophies: [skinId] });
  });

  it("asks for a retry when reports come faster than one per 2 s", () => {
    RULES.reportTrophy!(p.io, { skinId: "bc_knife" });
    expect(RULES.reportTrophy!(p.io, { skinId: "bc_warlord" })).toMatchObject({ ok: false, retry: true });
  });

  it("rate-limits in server time - a burst, then trophiesPerMinute - whatever the client claims", () => {
    const ids = Object.entries(DATA.trophies)
      .filter(([, t]: any) => !t.vault && t.minLoops === 0)
      .map(([id]) => id);
    const granted = () => p.st.owned.length;
    for (const skinId of ids.slice(0, DATA.trophyBurst)) {
      expect(RULES.reportTrophy!(p.io, { skinId, elapsedSec: 99999, runId: "fresh" }).ok).toBe(true);
      p.st.t += DATA.trophyGapSec;
    }
    const over = RULES.reportTrophy!(p.io, { skinId: ids[DATA.trophyBurst], elapsedSec: 99999, runId: "another" });
    expect(over).toMatchObject({ ok: false, retry: true });
    expect(granted()).toBe(DATA.trophyBurst);
    p.st.t += 60 / DATA.trophiesPerMinute;
    expect(RULES.reportTrophy!(p.io, { skinId: ids[DATA.trophyBurst] }).ok).toBe(true);
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

  it("two tabs buying the same level at once are charged once (one Reason per perk level)", () => {
    p.st.clout = 100;
    // both executions read level 0 before either wrote: replay the second with the meta as it was
    const before = JSON.parse(JSON.stringify(p.st.data.ReadOnly));
    RULES.buyPerk!(p.io, { perkId: "luck", level: 0 });
    p.st.data.ReadOnly = before;
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: true, perks: { luck: 1 } });
    expect(p.st.clout).toBe(100 - perkCost("luck", 0)!);
    expect(p.st.ops.map((o) => o.reason)).toEqual(["perk:U1:luck:0", "perk:U1:luck:0"]);
  });

  it("refuses without enough CLOUT, past max level, an unknown or prototype perk", () => {
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: false, reason: "not enough CLOUT" });
    p.st.clout = 1e9;
    for (let lv = 0; perkCost("botAwake", lv) !== null; lv++) RULES.buyPerk!(p.io, { perkId: "botAwake", level: lv });
    expect(RULES.buyPerk!(p.io, { perkId: "botAwake" })).toMatchObject({ ok: false, reason: "max level" });
    for (const perkId of ["nope", "constructor", "__proto__"]) expect(RULES.buyPerk!(p.io, { perkId })).toMatchObject({ ok: false, reason: "unknown perk" });
  });

  it("asks for a retry when the save fails, and the retry does not charge again", () => {
    p.st.clout = 100;
    p.st.failWrites = true;
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: false, retry: true });
    p.st.failWrites = false;
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: true, perks: { luck: 1 } });
    expect(p.st.clout).toBe(100 - perkCost("luck", 0)!);
  });

  it("never puts a '.' in a Reason (the platform refuses it)", () => {
    p.st.clout = 100;
    p.st.t = 1_000_000.375;
    expect(RULES.buyPerk!(p.io, { perkId: "luck", level: 0 }).ok).toBe(true);
    for (const o of p.st.ops) expect(o.reason).not.toContain(".");
  });
});

describe("saveMeta", () => {
  it("keeps the larger stats, caps them by time, and checks the charm picks", () => {
    p.st.t += 400; // first seen 1000 s ago (beforeEach)
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

const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

describe("wallet on the board (F8)", () => {
  const walletWrites = () => p.st.writes.filter((w) => w === "Public:cc_wallet").length;

  it("endRun publishes the verified wallet once", () => {
    p.st.wallet = WALLET;
    end();
    expect(p.st.data.Public!.cc_wallet).toBe(WALLET);
    p.st.t += 900;
    end({ runId: "r2", trophy: "vault2", lifetimeEarnings: 2e9 });
    expect(p.st.data.Public!.cc_wallet).toBe(WALLET);
    expect(walletWrites()).toBe(1);
  });

  it("a player without a wallet gets no key", () => {
    end();
    expect(p.st.data.Public!.cc_wallet).toBeUndefined();
    expect(walletWrites()).toBe(0);
  });

  it("writes the verified wallet back over one the player set themselves", () => {
    p.st.wallet = WALLET;
    p.st.data.Public!.cc_wallet = "So11111111111111111111111111111111111111112";
    end();
    expect(p.st.data.Public!.cc_wallet).toBe(WALLET);
  });

  it("clears a wallet the player set themselves when the account has none", () => {
    p.st.data.Public!.cc_wallet = WALLET;
    end();
    expect(p.st.data.Public!.cc_wallet).toBe("");
  });

  it("publishes on a duplicate endRun too (a player who linked a wallet after the run)", () => {
    end();
    p.st.wallet = WALLET;
    expect(end()).toMatchObject({ duplicate: true });
    expect(p.st.data.Public!.cc_wallet).toBe(WALLET);
  });

  it("a failed wallet write does not fail the run", () => {
    p.st.wallet = WALLET;
    const io = { ...p.io, writeData: (b: string, k: string, v: unknown) => (k === "cc_wallet" ? false : p.io.writeData(b, k, v)) };
    expect(RULES.endRun!(io, { runId: "r1", lifetimeEarnings: 1.2e6, elapsedSec: 480, endedAgoSec: 0, finaleReached: true, trophy: "vault1" })).toMatchObject({
      ok: true,
      loops: 1,
    });
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

  it("makeIo reads the account's verified Solana wallet from the Blockchain user data", () => {
    const ioWith = (blockchain: unknown) => {
      const fields: unknown[] = [];
      const server = {
        ReadUserData: (f: unknown) => (fields.push(f), { Blockchain: blockchain }),
        GetUserCustomData: () => ({ Success: true, Data: { Public: { cc_wallet: { Value: WALLET } } } }),
      };
      return { io: makeIo(server, { UserID: "U1" }), fields };
    };
    const login = ioWith({ LastWalletLogin: { NetworkID: "solana", Address: WALLET }, LinkedWallets: {} });
    expect(login.io.walletAddress()).toBe(WALLET);
    expect(login.fields).toEqual([["Blockchain"]]);
    expect(login.io.readRaw("Public", "cc_wallet")).toBe(WALLET); // a String key, not JSON
    expect(login.io.readRaw("Public", "nope")).toBeNull();
    // a wallet linked by signature on the Solana network, whatever the map is keyed by
    expect(ioWith({ LinkedWallets: { solana: { NetworkID: "solana", Address: WALLET, IsSignatureVerified: true } } }).io.walletAddress()).toBe(WALLET);
    expect(ioWith({ LinkedWallets: { [WALLET]: { NetworkID: "solana", Address: WALLET, LinkType: "SignatureVerified" } } }).io.walletAddress()).toBe(WALLET);
    // not a Solana wallet, not proven by a signature, not an address, or nothing at all
    expect(ioWith({ LastWalletLogin: { NetworkID: "bsc", Address: "0x12ab" }, LinkedWallets: {} }).io.walletAddress()).toBeNull();
    expect(ioWith({ LinkedWallets: { solana: { NetworkID: "solana", Address: WALLET, LinkType: "AutoLinkedFromTransaction" } } }).io.walletAddress()).toBeNull();
    expect(ioWith({ LastWalletLogin: { NetworkID: "solana", Address: "<script>" } }).io.walletAddress()).toBeNull();
    expect(ioWith(null).io.walletAddress()).toBeNull();
    expect(makeIo({ ReadUserData: () => ({}) }, {}).walletAddress()).toBeNull();
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
