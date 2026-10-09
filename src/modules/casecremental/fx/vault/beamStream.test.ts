import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { itemDistance } from "./beams";
import {
  beamWidthAt,
  firstItem,
  firstVisible,
  followCamera,
  iconScale,
  isCoin,
  itemJitter,
  lastVisible,
  maxVisibleItems,
  STREAM_ITEMS_PER_SECOND,
  STREAM_SPACING,
} from "./beamStream";

describe("a beam's stream", () => {
  const spacing = 115;
  const spotDist = 420;
  const reach = 900;

  it("shows exactly the items between the mouth and the reach, never more than the pool holds", () => {
    const pool = maxVisibleItems(reach, spacing);
    for (let p = 0; p <= 60; p += 0.37) {
      const from = firstVisible(p, spotDist, reach, spacing, -1e9);
      const to = lastVisible(p, spotDist, spacing);
      expect(to - from + 1).toBeLessThanOrEqual(pool);
      for (let j = from; j <= to; j++) {
        const d = itemDistance(p, j, 30, spacing, spotDist);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(reach + 1e-9);
      }
      expect(itemDistance(p, from - 1, 30, spacing, spotDist)).toBeGreaterThan(reach);
      expect(itemDistance(p, to + 1, 30, spacing, spotDist)).toBeLessThan(0);
    }
  });

  it("starts empty: every item from firstItem on is still inside the chest before the spin", () => {
    const first = firstItem(spotDist, spacing);
    expect(itemDistance(0, first, 30, spacing, spotDist)).toBeLessThanOrEqual(0);
    expect(firstVisible(0, spotDist, reach, spacing, first)).toBeGreaterThan(lastVisible(0, spotDist, spacing));
  });

  it("puts the reward on screen when the strip stops on it", () => {
    const from = firstVisible(30, spotDist, reach, spacing, 0);
    const to = lastVisible(30, spotDist, spacing);
    expect(from).toBeLessThanOrEqual(30);
    expect(to).toBeGreaterThanOrEqual(30);
  });

  it("hides everything while the beam has not grown", () => {
    expect(firstVisible(10, spotDist, 0, spacing, 0)).toBeGreaterThan(lastVisible(10, spotDist, spacing) - 1);
  });
});

describe("itemJitter", () => {
  it("is a fixed offset per item in [-1, 1], different from item to item and seed to seed", () => {
    const xs = Array.from({ length: 1000 }, (_, j) => itemJitter(12345, j));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1);
    }
    expect(itemJitter(12345, 7)).toBe(xs[7]);
    expect(new Set(xs.map((x) => x.toFixed(6))).size).toBeGreaterThan(990);
    expect(Math.abs(xs.reduce((s, x) => s + x, 0) / xs.length)).toBeLessThan(0.1);
    expect(itemJitter(999, 7)).not.toBe(xs[7]);
    expect(itemJitter(1, -5)).toBeGreaterThanOrEqual(-1);
  });
});

describe("isCoin", () => {
  it("makes one item in three a coin, never the reward", () => {
    const coins = Array.from({ length: 30 }, (_, j) => isCoin(j, 1000)).filter(Boolean).length;
    expect(coins).toBe(10);
    for (let target = 0; target < 6; target++) expect(isCoin(target, target)).toBe(false);
    expect(isCoin(-1, 50)).toBe(true); // negative indices follow the same rhythm
  });
});

describe("iconScale", () => {
  it("is a whole number from 1 to k that fits the texture in the icon box", () => {
    expect(iconScale(26, 10, 192, 6)).toBe(6);
    expect(iconScale(40, 12, 192, 6)).toBe(4);
    expect(iconScale(26, 10, 64, 2)).toBe(2);
    expect(iconScale(300, 10, 64, 2)).toBe(1);
    for (const [w, h, box, k] of [
      [26, 10, 128, 4],
      [33, 20, 96, 3],
      [18, 18, 64, 2],
    ] as const) {
      const s = iconScale(w, h, box, k);
      expect(Number.isInteger(s)).toBe(true);
      expect(s * Math.max(w, h)).toBeLessThanOrEqual(box);
    }
  });
});

describe("beamWidthAt", () => {
  it("narrows toward the mouth and widens out along the beam", () => {
    const beam = { width: 200, length: 1000 };
    expect(beamWidthAt(beam, 0)).toBeCloseTo(80, 9);
    expect(beamWidthAt(beam, 500)).toBeGreaterThan(beamWidthAt(beam, 0));
    expect(beamWidthAt(beam, 1000)).toBeGreaterThan(beamWidthAt(beam, 500));
    expect(beamWidthAt(beam, 1000)).toBeCloseTo(260, 9);
  });
});

describe("the stream's speed", () => {
  it("runs 1.5× faster on screen than the calm version (10 items a second, 0.6 of an icon box apart)", () => {
    expect(STREAM_ITEMS_PER_SECOND * STREAM_SPACING).toBeCloseTo(1.5 * 10 * 0.6, 9);
  });

  it("moves an item well under half its spacing per frame at 60 fps (no wagon-wheel)", () => {
    expect(STREAM_ITEMS_PER_SECOND / 60).toBeLessThan(0.5);
  });
});

describe("followCamera", () => {
  // the beams' camera: a punch about the mouth, a shake, a slight turn; and the stream's slot, bobbing
  const cam = new Container();
  cam.pivot.set(400, 600);
  cam.position.set(409, 594);
  cam.scale.set(1.05);
  cam.rotation = 0.02;
  const slot = { x: 0, y: -3 };
  const p = { x: 250, y: 180 };
  /** Where a layer in the slot draws p, in the slot's and the camera's shared parent. */
  const drawn = (layer: Container) => {
    const q = layer.toGlobal(p);
    return { x: q.x + slot.x, y: q.y + slot.y };
  };

  it("puts a layer in its slot exactly where the camera puts the beams, at share 1", () => {
    const layer = new Container();
    followCamera(layer, cam, slot, 1);
    const want = cam.toGlobal(p);
    expect(drawn(layer).x).toBeCloseTo(want.x, 9);
    expect(drawn(layer).y).toBeCloseTo(want.y, 9);
  });

  it("leaves the layer where it is at share 0, and halfway at 0.5 (no turn)", () => {
    const layer = new Container();
    followCamera(layer, cam, slot, 0);
    expect(layer.toGlobal(p).x).toBeCloseTo(p.x, 9);
    expect(layer.toGlobal(p).y).toBeCloseTo(p.y, 9);
    const flat = new Container();
    flat.pivot.copyFrom(cam.pivot);
    flat.position.copyFrom(cam.position);
    flat.scale.copyFrom(cam.scale);
    const full = flat.toGlobal(p);
    followCamera(layer, flat, slot, 0.5);
    expect(drawn(layer).x).toBeCloseTo((p.x + slot.x + full.x) / 2, 9);
    expect(drawn(layer).y).toBeCloseTo((p.y + slot.y + full.y) / 2, 9);
  });
});
