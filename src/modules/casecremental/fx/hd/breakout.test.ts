import { describe, expect, it } from "vitest";
import type { Drop, RarityId } from "../../sim/types";
import { tableLayout } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import {
  AWAY_SECONDS,
  BREAKOUT_MAX_WAIT,
  BreakoutQueue,
  breakoutPeak,
  breakoutPose,
  breakoutSeconds,
  breakoutTarget,
  POP_SECONDS,
} from "./breakout";
import { FLIGHT_SECONDS } from "./knifeFlight";

let n = 1;
const drop = (rarity: RarityId): Drop => ({
  id: n++,
  caseId: "bootcamp",
  skinId: "bc_warlord",
  rarity,
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
});

describe("the grid's breakouts (spec §6's visual budget)", () => {
  it("lasts long enough for a Covert's hit and a ★'s whole knife showcase", () => {
    expect(breakoutSeconds("covert")).toBeCloseTo(2, 9);
    expect(breakoutSeconds("gold")).toBeCloseTo(POP_SECONDS + FLIGHT_SECONDS + AWAY_SECONDS, 9);
  });

  it("plays one at a time, in order", () => {
    const q = new BreakoutQueue();
    q.push({ drop: drop("covert"), cell: 0, at: 0 });
    q.push({ drop: drop("covert"), cell: 1, at: 0 });
    expect(q.step(0).start?.cell).toBe(0);
    expect(q.step(1).start).toBeNull();
    expect(q.step(breakoutSeconds("covert")).start?.cell).toBe(1);
  });

  it("shows one that waited longer than BREAKOUT_MAX_WAIT as a flash instead", () => {
    const q = new BreakoutQueue();
    q.push({ drop: drop("gold"), cell: 0, at: 0 });
    q.push({ drop: drop("covert"), cell: 1, at: 0 });
    q.push({ drop: drop("covert"), cell: 2, at: 0.1 });
    expect(q.step(0).start?.cell).toBe(0); // the ★ plays for 3 s
    const later = q.step(BREAKOUT_MAX_WAIT + 0.01);
    expect(later.expired.map((w) => w.cell)).toEqual([1]);
    expect(later.start?.cell).toBe(2); // waited 2.91 s: still in time
  });

  it("never starts more than one every two seconds however many arrive, and nobody waits past the limit (Review Focus 3)", () => {
    const q = new BreakoutQueue();
    const starts: number[] = [];
    const waits: number[] = [];
    for (let i = 0; i < 1200; i++) {
      const now = i / 60;
      if (i % 3 === 0) q.push({ drop: drop(i % 2 ? "gold" : "covert"), cell: i % 50, at: now });
      const r = q.step(now);
      if (r.start) {
        starts.push(now);
        waits.push(now - r.start.at);
      }
    }
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(breakoutSeconds("covert") - 1e-9);
    for (const w of waits) expect(w).toBeLessThanOrEqual(BREAKOUT_MAX_WAIT);
  });

  it("pops out of its cell, holds at the peak, then shrinks away", () => {
    const total = breakoutSeconds("covert");
    expect(breakoutPose(0, total)).toMatchObject({ leg: 0, mix: 0 });
    expect(breakoutPose(0, total).scale).toBeCloseTo(0.2, 9);
    expect(breakoutPose(POP_SECONDS, total)).toEqual({ leg: 1, mix: 1, scale: 1 });
    expect(breakoutPose(total - AWAY_SECONDS / 2, total).leg).toBe(2);
    expect(breakoutPose(total, total)).toMatchObject({ leg: 2, mix: 1 });
    expect(breakoutPose(total, total).scale).toBeCloseTo(0.2, 9);
  });

  it("sends the card where its drop went: the tray, the locker, back to a stalled cell, else the seller", () => {
    const l = tableLayout(pixelViewport(1920, 1080));
    const d = drop("covert");
    const cellPt = { x: 1, y: 2 };
    const empty = { tray: [], locker: { items: [] }, grid: { cells: [] } };
    expect(breakoutTarget({ ...empty, tray: [d] }, d.id, 0, l, cellPt)).toEqual({ x: l.tray.x + l.tray.w / 2, y: l.tray.y + l.tray.h / 2 });
    expect(breakoutTarget({ ...empty, locker: { items: [d] } }, d.id, 0, l, cellPt).x).toBe(l.locker.x + l.locker.w / 2);
    expect(breakoutTarget({ ...empty, grid: { cells: [{ drop: d }] } }, d.id, 0, l, cellPt)).toEqual(cellPt);
    expect(breakoutTarget(empty, d.id, 0, l, cellPt).x).toBe(l.seller.x);
    expect(breakoutPeak(l).y).toBeLessThan(l.grid.y);
  });
});
