import { describe, expect, it } from "vitest";
import { ServerMeta, type PortReply, type ServerPort } from "./bridge";
import { CallQueue } from "./queue";

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

  it("does not submit the score when the server did", async () => {
    const { port, calls } = fakePort({ endRun: [{ kind: "ok", data: doc({ score: 6079, serverScore: true }) }] });
    const s = new ServerMeta(port, new CallQueue(null), () => 0);
    s.enqueue("endRun", {}, "e");
    await s.pump();
    expect(calls).toEqual(["endRun"]);
  });
});
