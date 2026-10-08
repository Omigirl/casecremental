import { describe, expect, it } from "vitest";
import { Timeline } from "./timeline";

const KEYS = [
  { frame: 0, ms: 100, event: "start" },
  { frame: 1, ms: 50, dy: -2, eyes: "happy" as const },
  { frame: 2, ms: 100, event: "pop" },
];

describe("Timeline", () => {
  it("fires the first key's event on the first advance and holds poses for their durations", () => {
    const tl = new Timeline(KEYS);
    expect(tl.advance(0)).toEqual(["start"]);
    expect(tl.pose).toMatchObject({ frame: 0, dy: 0, eyes: "open" });
    expect(tl.advance(99)).toEqual([]);
    expect(tl.advance(1)).toEqual([]);
    expect(tl.pose).toMatchObject({ frame: 1, dy: -2, eyes: "happy" });
    expect(tl.advance(50)).toEqual(["pop"]);
    expect(tl.pose.frame).toBe(2);
  });

  it("can cross several keys in one big step and report every event", () => {
    const tl = new Timeline(KEYS);
    expect(tl.advance(1000)).toEqual(["start", "pop"]);
    expect(tl.done).toBe(true);
    expect(tl.pose.frame).toBe(2);
  });

  it("loops when asked", () => {
    const tl = new Timeline(KEYS, true);
    tl.advance(250);
    expect(tl.done).toBe(false);
    expect(tl.pose.frame).toBe(0);
    expect(tl.advance(10)).toEqual([]);
  });

  it("restart replays from the first key", () => {
    const tl = new Timeline(KEYS);
    tl.advance(1000);
    tl.restart();
    expect(tl.advance(0)).toEqual(["start"]);
    expect(tl.done).toBe(false);
  });
});
