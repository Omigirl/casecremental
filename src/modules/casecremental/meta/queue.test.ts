import { describe, expect, it } from "vitest";
import { accountKey } from "./account";
import { BACKOFF_SECONDS, CallQueue, MAX_QUEUE, MAX_TRIES, OFFLINE_MAX_WAIT, QUEUE_KEY } from "./queue";

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
    q.retryLater("a", 0, false);
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

  it("survives a reload and drops a trophy report or a save after MAX_TRIES answered failures", () => {
    const store = memory();
    new CallQueue(store).push({ id: "a", name: "reportTrophy", args: { x: 1 } }, 0);
    const q = new CallQueue(store);
    expect(q.head(0)).toMatchObject({ id: "a", args: { x: 1 } });
    let dropped = false;
    for (let i = 0; i < MAX_TRIES; i++) dropped = q.retryLater("a", 1e9, false);
    expect(dropped).toBe(true);
    expect(q.size).toBe(0);
    store.setItem(QUEUE_KEY, "{broken");
    expect(new CallQueue(store).size).toBe(0);
  });

  it("never counts time offline, and never gives up on an endRun or buyPerk", () => {
    const store = memory();
    const q = new CallQueue(store);
    q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
    for (let i = 0; i < MAX_TRIES * 10; i++) expect(q.retryLater("t", i * 100, true)).toBe(false); // hours offline
    expect(q.head(1e9)).toMatchObject({ id: "t", strikes: 0 });
    expect(new CallQueue(store).head(1e9)).toMatchObject({ id: "t", strikes: 0 }); // nor across a reload
    q.done("t");
    q.push({ id: "e", name: "endRun", args: {} }, 0);
    q.push({ id: "p", name: "buyPerk", args: {} }, 0);
    for (let i = 0; i < MAX_TRIES * 3; i++) expect(q.retryLater("e", 0, false)).toBe(false);
    expect(q.size).toBe(2);
  });

  it("backs off offline at most OFFLINE_MAX_WAIT, answered failures up to the last back-off, and wakes on demand", () => {
    const q = new CallQueue(null);
    q.push({ id: "a", name: "endRun", args: {} }, 0);
    for (let i = 0; i < 8; i++) q.retryLater("a", 0, true);
    expect(q.head(OFFLINE_MAX_WAIT)).not.toBeNull();
    for (let i = 0; i < 8; i++) q.retryLater("a", 0, false);
    expect(q.head(OFFLINE_MAX_WAIT)).toBeNull();
    expect(q.head(BACKOFF_SECONDS.at(-1)!)).not.toBeNull();
    q.retryLater("a", 0, false);
    q.wake(1);
    expect(q.head(1)).not.toBeNull();
  });

  it("when full, drops the oldest call that may be lost, never a write", () => {
    const q = new CallQueue(null);
    q.push({ id: "e", name: "endRun", args: {} }, 0);
    for (let i = 0; i < MAX_QUEUE; i++) q.push({ id: `t${i}`, name: "reportTrophy", args: {} }, 0);
    expect(q.size).toBe(MAX_QUEUE);
    expect(q.head(0)!.id).toBe("e");
  });

  it("keeps each account's calls under its own key", () => {
    const store = memory();
    new CallQueue(store, accountKey(QUEUE_KEY, "A")).push({ id: "a", name: "endRun", args: {} }, 0);
    expect(new CallQueue(store, accountKey(QUEUE_KEY, "B")).size).toBe(0);
    expect(new CallQueue(store, accountKey(QUEUE_KEY, "A")).size).toBe(1);
  });

  it("says when an endRun or buyPerk is still waiting", () => {
    const q = new CallQueue(null);
    q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
    expect(q.hasWrites()).toBe(false);
    q.push({ id: "p", name: "buyPerk", args: {} }, 0);
    expect(q.hasWrites()).toBe(true);
  });
});
