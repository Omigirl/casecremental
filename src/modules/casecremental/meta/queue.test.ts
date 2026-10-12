import { describe, expect, it } from "vitest";
import { CallQueue, MAX_TRIES, QUEUE_KEY } from "./queue";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("CallQueue", () => {
  it("is first in, first out, and only hands out a due call", () => {
    const q = new CallQueue(memory());
    q.push({ id: "a", name: "endRun", args: {} }, 0);
    q.push({ id: "b", name: "buyPerk", args: {} }, 0);
    expect(q.head(0)!.id).toBe("a");
    q.retryLater("a", 0);
    expect(q.head(0)).toBeNull(); // b waits behind a
    expect(q.head(10)!.id).toBe("a");
    q.done("a");
    expect(q.head(10)!.id).toBe("b");
  });

  it("keeps one saveMeta (the newest) and ignores a duplicate id", () => {
    const q = new CallQueue(memory());
    q.push({ id: "m1", name: "saveMeta", args: { n: 1 } }, 0);
    q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
    q.push({ id: "m2", name: "saveMeta", args: { n: 2 } }, 0);
    q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
    expect(q.size).toBe(2);
    q.done("t");
    expect(q.head(0)!.args).toEqual({ n: 2 });
  });

  it("survives a reload and drops a call after MAX_TRIES", () => {
    const store = memory();
    new CallQueue(store).push({ id: "a", name: "endRun", args: { x: 1 } }, 0);
    const q = new CallQueue(store);
    expect(q.head(0)).toMatchObject({ id: "a", args: { x: 1 } });
    let dropped = false;
    for (let i = 0; i < MAX_TRIES; i++) dropped = q.retryLater("a", 1e9);
    expect(dropped).toBe(true);
    expect(q.size).toBe(0);
    store.setItem(QUEUE_KEY, "{broken");
    expect(new CallQueue(store).size).toBe(0);
  });

  it("says when an endRun or buyPerk is still waiting", () => {
    const q = new CallQueue(null);
    q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
    expect(q.hasWrites()).toBe(false);
    q.push({ id: "p", name: "buyPerk", args: {} }, 0);
    expect(q.hasWrites()).toBe(true);
  });
});
