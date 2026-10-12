import { describe, expect, it } from "vitest";
import { ServerMeta, type PortReply, type ServerPort } from "./bridge";
import { CallQueue, MAX_TRIES, type JsonObject } from "./queue";

const doc = (over = {}) => ({
  ok: true,
  clout: 5,
  trophies: ["bc_knife"],
  perks: { luck: 1 },
  loops: 1,
  stats: { playSeconds: 1, opened: 2, best: null, cloutEarned: 5 },
  picked: [],
  ...over,
});
function fakePort(replies: Record<string, PortReply[]>) {
  const calls: string[] = [];
  const port: ServerPort = {
    call: async (name) => (calls.push(name), replies[name]?.shift() ?? { kind: "offline", reason: "down" }),
    submitScore: async (score) => (calls.push(`score:${score}`), { kind: "ok", data: {} }),
  };
  return { port, calls };
}
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("ServerMeta", () => {
  it("loads the doc, goes online and remembers the trophies", async () => {
    const { port } = fakePort({ loadMeta: [{ kind: "ok", data: doc() }] });
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    const seen: unknown[] = [];
    s.onDoc((d) => seen.push(d));
    expect(await s.load()).toMatchObject({ clout: 5, loops: 1 });
    expect(s.status).toBe("online");
    expect(s.trophies.has("bc_knife")).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it("is offline, not broken, when the port fails", async () => {
    const { port } = fakePort({});
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    expect(await s.load()).toBeNull();
    expect(s.status).toBe("offline");
  });

  it("is offline, not broken, when the port throws", async () => {
    const port: ServerPort = {
      call: async () => {
        throw new Error("boom");
      },
      submitScore: async () => ({ kind: "ok", data: {} }),
    };
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    expect(await s.load()).toBeNull();
    expect(s.status).toBe("offline");
  });

  it("keeps calls across a reload and sends them when the port comes back", async () => {
    const store = memory();
    const down = fakePort({});
    const a = new ServerMeta(down.port, new CallQueue(store), () => 0);
    a.enqueue("endRun", { runId: "r1" }, "end-r1");
    await a.pump();
    expect(a.hasPendingWrites()).toBe(true);
    const up = fakePort({ endRun: [{ kind: "ok", data: doc({ score: 6079, serverScore: false }) }] });
    const b = new ServerMeta(up.port, new CallQueue(store), () => 1e6);
    await b.pump();
    expect(up.calls).toEqual(["endRun", "score:6079"]);
    expect(b.hasPendingWrites()).toBe(false);
  });

  it("drops a call the server refuses for good, retries one it asks to retry", async () => {
    const { port, calls } = fakePort({
      reportTrophy: [{ kind: "refused", reason: "not a trophy", retry: false }],
      buyPerk: [{ kind: "refused", reason: "too fast", retry: true }],
    });
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    s.enqueue("reportTrophy", {}, "t");
    s.enqueue("buyPerk", {}, "p");
    await s.pump();
    expect(calls).toEqual(["reportTrophy", "buyPerk"]);
    expect(s.hasPendingWrites()).toBe(true); // buyPerk waits for its retry
  });

  it("keeps an endRun through any number of offline pumps, and drains it when the server answers", async () => {
    const store = memory();
    let t = 0;
    const down = fakePort({});
    const a = new ServerMeta(down.port, new CallQueue(store), () => t);
    a.enqueue("endRun", { runId: "r1", endedAt: 0 }, "end-r1");
    for (let i = 0; i < MAX_TRIES * 5; i++) {
      t += 3600;
      await a.retryNow();
    }
    expect(a.hasPendingWrites()).toBe(true);
    const up = fakePort({ endRun: [{ kind: "ok", data: doc({ score: 1, serverScore: true }) }] });
    await new ServerMeta(up.port, new CallQueue(store), () => t).retryNow();
    expect(up.calls).toEqual(["endRun"]);
  });

  it("says when the run ended as seconds ago at send time", async () => {
    const seen: JsonObject[] = [];
    const port: ServerPort = {
      call: async (_name, args) => (seen.push(args), { kind: "ok", data: doc() }),
      submitScore: async () => ({ kind: "ok", data: {} }),
    };
    const s = new ServerMeta(port, new CallQueue(null), () => 1000);
    s.enqueue("endRun", { runId: "r1", endedAt: 400 }, "e");
    await s.pump();
    expect(seen[0]).toMatchObject({ endedAt: 400, endedAgoSec: 600 });
  });

  it("loads the server's meta after it refuses a write for good", async () => {
    const { port, calls } = fakePort({
      buyPerk: [{ kind: "refused", reason: "not enough CLOUT", retry: false }],
      loadMeta: [{ kind: "ok", data: doc({ clout: 2 }) }],
    });
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    const docs: number[] = [];
    s.onDoc((d) => docs.push(d.clout));
    s.enqueue("buyPerk", { perkId: "luck", level: 0 }, "p");
    await s.pump();
    expect(calls).toEqual(["buyPerk", "loadMeta"]);
    expect(docs).toEqual([2]);
  });

  it("ignores a loadMeta answer a write's answer overtook", async () => {
    let release: (r: PortReply) => void = () => {};
    const port: ServerPort = {
      call: (name) =>
        name === "loadMeta"
          ? new Promise<PortReply>((r) => (release = r))
          : Promise.resolve({ kind: "ok", data: doc({ clout: 9, loops: 2 }) }),
      submitScore: async () => ({ kind: "ok", data: {} }),
    };
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    const docs: number[] = [];
    s.onDoc((d) => docs.push(d.clout));
    const loading = s.load();
    s.enqueue("endRun", { runId: "r1" }, "e");
    await s.pump();
    release({ kind: "ok", data: doc({ clout: 1, loops: 1 }) }); // sent before the endRun, answered after it
    expect(await loading).toBeNull();
    expect(docs).toEqual([9]);
  });

  it("sends the endRun behind a trophy report the server asked to retry (its case not counted yet)", async () => {
    const { port, calls } = fakePort({
      reportTrophy: [{ kind: "refused", reason: "case not reached yet", retry: true }],
      endRun: [{ kind: "ok", data: doc({ serverScore: true }) }],
    });
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    s.enqueue("reportTrophy", { skinId: "mf_root" }, "t");
    s.enqueue("endRun", { runId: "r1" }, "e");
    await s.pump();
    expect(calls).toEqual(["reportTrophy", "endRun"]);
    expect(s.hasPendingWrites()).toBe(false);
  });

  it("does not submit the score when the server did", async () => {
    const { port, calls } = fakePort({ endRun: [{ kind: "ok", data: doc({ score: 6079, serverScore: true }) }] });
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    s.enqueue("endRun", {}, "e");
    await s.pump();
    expect(calls).toEqual(["endRun"]);
  });
});
