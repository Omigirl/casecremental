import { describe, expect, it, vi } from "vitest";
import { ServerMeta, type ServerPort } from "../meta/bridge";
import { CallQueue, type JsonObject } from "../meta/queue";
import { freshMeta } from "../sim/meta";
import type { SimEvent } from "../sim/run";
import type { Drop } from "../sim/types";
import { connectServer, runIdOf, type SyncTarget } from "./serverSync";

const knife: Drop = { id: 1, caseId: "bootcamp", skinId: "bc_knife", rarity: "gold", float: 0.1, wear: "FN", statTrak: false, value: 99 };

function setup() {
  const sent: Array<[string, Record<string, unknown>]> = [];
  const port: ServerPort = {
    call: vi.fn(async (name: string, args: JsonObject) => (sent.push([name, args]), { kind: "offline" as const, reason: "test" })),
    submitScore: vi.fn(),
  };
  let listener: (e: SimEvent) => void = () => {};
  const target: SyncTarget & { applied: number } = {
    meta: freshMeta(),
    run: { seed: 12345, setup: { charms: ["fever"] }, state: { time: 300 } },
    onEvent: (l) => ((listener = l), () => {}),
    applied: 0,
    applyServerMeta() {
      this.applied++;
    },
  };
  const queue = new CallQueue(null);
  const server = new ServerMeta(port, queue, () => 0);
  const stop = connectServer(target, server, 0);
  return { fire: (e: SimEvent) => listener(e), sent, queue, target, stop, server };
}

describe("connectServer", () => {
  it("reports a trophy the player does not own yet, once", () => {
    const s = setup();
    s.fire({ type: "revealed", drops: [knife, knife] });
    s.fire({ type: "botRevealed", drops: [knife] });
    expect(s.queue.size).toBe(1);
    expect(s.sent.find(([n]) => n === "reportTrophy")![1]).toEqual({ skinId: "bc_knife", runId: runIdOf(12345), elapsedSec: 300 });
    s.stop();
  });

  it("ends the run on the vault and saves the charm picks", () => {
    const s = setup();
    s.fire({ type: "vaultOpened", trophy: "vault1", drop: knife, lifetimeEarnings: 1.2e6 });
    const end = s.sent.find(([n]) => n === "endRun")![1];
    expect(end).toMatchObject({ runId: runIdOf(12345), lifetimeEarnings: 1.2e6, elapsedSec: 300, finaleReached: true, trophy: "vault1" });
    expect(typeof end.endedAt).toBe("number");
    expect(s.queue.size).toBe(2); // endRun waits (offline); saveMeta queued behind it
    s.stop();
  });

  it("buys a perk at the level it had before", () => {
    const s = setup();
    s.fire({ type: "perkBought", id: "luck", level: 2 });
    expect(s.sent.find(([n]) => n === "buyPerk")![1]).toEqual({ perkId: "luck", level: 1 });
    s.stop();
  });

  it("sends the charm picks, and the campaign stats once the meta has them", () => {
    const s = setup();
    s.target.meta.picked = ["insider"];
    s.fire({ type: "charmPicked" });
    expect(s.queue.size).toBe(1);
    Object.assign(s.target.meta, { stats: { playSeconds: 61.7, opened: 40, best: { ...knife }, cloutEarned: 3 } });
    s.fire({ type: "runStarted" });
    expect(s.queue.size).toBe(1); // one saveMeta waits: the newest
    s.stop();
  });

  it("never waits for the server: the listener returns at once", () => {
    const s = setup();
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) s.fire({ type: "revealed", drops: [knife] });
    expect(performance.now() - t0).toBeLessThan(50);
    s.stop();
  });
});

describe("metaArgs", () => {
  it("is the picks alone before F6-A, picks and stats after", async () => {
    const { metaArgs } = await import("./serverSync");
    const m = freshMeta();
    m.picked = ["insider"];
    delete (m as { stats?: unknown }).stats; // a meta from before F6-A's campaign stats
    m.offer = ["insider", "fever"]; // on the prestige screen: the picks being made
    expect(metaArgs(m, [])).toEqual({ picked: ["insider"] });
    Object.assign(m, { stats: { playSeconds: 61.7, opened: 40, best: { ...knife }, cloutEarned: 3 } });
    expect(metaArgs(m, [])).toEqual({
      picked: ["insider"],
      stats: { playSeconds: 61, opened: 40, best: { skinId: "bc_knife", value: 99 } },
    });
  });

  it("sends the run's own charms during a run (the meta's picks are cleared when it starts)", async () => {
    const { metaArgs } = await import("./serverSync");
    const m = freshMeta();
    delete (m as { stats?: unknown }).stats;
    expect(metaArgs(m, ["fever", "insider"])).toEqual({ picked: ["fever", "insider"] });
  });
});
