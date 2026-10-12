import { describe, expect, it } from "vitest";
import { GameController } from "../../game/controller";
import type { SimEvent } from "../../sim/run";
import { lockerCapacity } from "../../sim/locker";
import { TRADE_UP_SECONDS } from "../../sim/tuning";
import type { Drop } from "../../sim/types";
import { ITEM_SIZE } from "../pixel/layout";
import {
  chipProgress,
  DOOR_OPEN_SECONDS,
  lampFontSize,
  lampRows,
  lockerDoor,
  lockerFrame,
  lockerFrameDx,
  PRESS,
  stampCrossed,
  STORE_FLIGHT_SECONDS,
  storeFlightAt,
} from "./lockerRules";

const drop = (id: number): Drop => ({
  id,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
});

describe("the locker's cabinet", () => {
  it("is dark until bought, stamps while pressing, opens its door just after a store, else glows", () => {
    expect(lockerFrame(false, null, 0)).toBe(0);
    expect(lockerFrame(false, PRESS.stampAt, 0.2)).toBe(0);
    expect(lockerFrame(true, null, 0)).toBe(1);
    expect(lockerFrame(true, null, 0.1)).toBe(3);
    expect(lockerFrame(true, PRESS.stampAt, 0)).toBe(2);
    expect(lockerFrame(true, PRESS.stampAt, 0.2)).toBe(2); // the stamp beats the door
    expect(lockerFrame(true, PRESS.liftAt, 0)).toBe(1);
    expect(lockerFrame(true, 0.2, 0)).toBe(1);
  });

  it("puts the built art's door-open frame back in line with the others (it was drawn 3 px left)", () => {
    expect(lockerFrameDx(3)).toBe(3);
    for (const f of [0, 1, 2]) expect(lockerFrameDx(f)).toBe(0);
  });

  it("flies the ten cards in one after another before the stamp, and lifts the press before the result pops", () => {
    expect(chipProgress(0, 10, 0)).toBe(0);
    expect(chipProgress(0, 10, PRESS.chipFlight)).toBe(1);
    expect(chipProgress(9, 10, PRESS.flyIn)).toBe(1);
    expect(chipProgress(9, 10, PRESS.flyIn - 0.01)).toBeLessThan(1);
    for (let i = 1; i < 10; i++) expect(chipProgress(i, 10, 0.3)).toBeLessThanOrEqual(chipProgress(i - 1, 10, 0.3));
    expect(PRESS.flyIn).toBeLessThanOrEqual(PRESS.stampAt);
    expect(PRESS.liftAt).toBeLessThan(TRADE_UP_SECONDS);
  });

  it("stamps once; a reload past the stamp stays quiet (Review Focus 2)", () => {
    expect(stampCrossed(0.9, 1.05)).toBe(true);
    expect(stampCrossed(1.05, 1.1)).toBe(false);
    expect(stampCrossed(null, 1.05)).toBe(false);
    expect(stampCrossed(0.9, -1)).toBe(false);
  });

  it("lays five lamp rows down the cabinet's face, Mil-Spec at the top", () => {
    const r = { x: 100, y: 50, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
    const rows = lampRows(r);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.lamp.x).toBeGreaterThan(r.x);
      expect(row.text.x).toBeGreaterThan(row.lamp.x);
      expect(row.lamp.y).toBeGreaterThan(r.y);
      expect(row.lamp.y).toBeLessThan(r.y + r.h);
      expect(row.text.y).toBe(row.lamp.y);
    }
    for (let i = 1; i < 5; i++) expect(rows[i]!.lamp.y).toBeGreaterThan(rows[i - 1]!.lamp.y);
  });

  it("keeps every lamp on the cabinet's body: below the press head (where a waiting result sits), above the floor", () => {
    // The built art (locker.png, 32×44, ground 42, placed bottom-centre on the 24×30 rect) puts the press head at
    // frame rows 13–23 and the body at rows 24–43: the body starts 12 px below the rect's top, its sides at x + 2..21.
    const r = { x: 100, y: 50, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
    const rows = lampRows(r);
    const pitch = rows[1]!.lamp.y - rows[0]!.lamp.y;
    for (const row of rows) {
      expect(row.lamp.y).toBeGreaterThanOrEqual(r.y + 12);
      expect(row.lamp.y + pitch / 2).toBeLessThanOrEqual(r.y + r.h);
      expect(row.lamp.x).toBeGreaterThanOrEqual(r.x + 3);
    }
    // a result waiting on the cabinet has its bottom 6 px into the rect (lockerCardSpots): the lamps stay clear of it
    expect(rows[0]!.lamp.y - pitch / 2).toBeGreaterThanOrEqual(r.y + 6);
  });

  it.each([2, 3, 4, 5, 6, 8, 10])("sizes the counts to one lamp row and the cabinet's width at scale %i", (k) => {
    const fs = lampFontSize(k);
    expect(fs % 8).toBe(0);
    const r0 = { x: 0, y: 0, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
    const rowH = lampRows(r0)[1]!.lamp.y - lampRows(r0)[0]!.lamp.y;
    expect(fs / k).toBeLessThanOrEqual(rowH); // a line's height, world px
    const r = { x: 0, y: 0, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
    expect(lampRows(r)[0]!.text.x + 2 * (fs / k)).toBeLessThanOrEqual(r.w); // "50" fits after the lamp
  });
});

describe("a card the auto-seller's Collect sends in", () => {
  const r = { x: 100, y: 50, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
  const from = { x: 20, y: 30 };

  it("flies from its spot into the cabinet's door, arcing up on the way, and is gone once in", () => {
    const door = lockerDoor(r);
    expect(door.x).toBeGreaterThan(r.x);
    expect(door.x).toBeLessThan(r.x + r.w);
    expect(door.y).toBeGreaterThan(r.y);
    expect(door.y).toBeLessThan(r.y + r.h);
    expect(storeFlightAt(from, door, 0)).toEqual(from);
    const mid = storeFlightAt(from, door, STORE_FLIGHT_SECONDS / 2)!;
    expect(mid.x).toBeCloseTo((from.x + door.x) / 2);
    expect(mid.y).toBeLessThan((from.y + door.y) / 2);
    const late = storeFlightAt(from, door, STORE_FLIGHT_SECONDS * 0.99)!;
    expect(Math.hypot(late.x - door.x, late.y - door.y)).toBeLessThan(2);
    expect(storeFlightAt(from, door, STORE_FLIGHT_SECONDS)).toBeNull();
  });

  it("lands while the door it opened is still open", () => {
    expect(STORE_FLIGHT_SECONDS).toBeLessThanOrEqual(DOOR_OPEN_SECONDS);
  });
});

describe("a store the locker refuses (Review Focus 1)", () => {
  it("emits nothing, so the card stays where it was", () => {
    const c = new GameController(3);
    c.devStartRun(2);
    c.devAddCash(1e9);
    expect(c.act({ type: "buyLocker" }).ok).toBe(true);
    c.run.state.locker.items.push(...Array.from({ length: lockerCapacity(0) }, (_, i) => drop(100 + i)));
    c.run.state.tray.push(drop(1));
    const events: SimEvent[] = [];
    c.onEvent((e) => events.push(e));
    expect(c.act({ type: "storeCard", from: "tray", slot: 0 }).ok).toBe(false);
    expect(events.some((e) => e.type === "lockerStored")).toBe(false);
    expect(c.run.state.tray.map((d) => d.id)).toEqual([1]);
  });
});
