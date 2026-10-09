import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { Drop, RarityId, SkinDef } from "../../sim/types";
import type { SkinTextures } from "../skins/pixelSkin";
import { BenchCards, bestSlot, centreOf, knifeSlot } from "./BenchCards";

// Multi-open's cards side by side: the once-only effects and the label lines follow the best card, the knife
// flight launches from the first ★ that flips, and the camera centres on the cards still waiting.

let nextId = 1;
const drop = (rarity: RarityId, value: number, skinId = "x"): Drop => ({
  id: nextId++,
  caseId: "bootcamp",
  skinId,
  rarity,
  float: 0.1,
  wear: "MW",
  statTrak: false,
  value,
});

describe("bestSlot", () => {
  it("is null when no card waits", () => {
    expect(bestSlot([])).toBeNull();
    expect(bestSlot([null, null])).toBeNull();
  });

  it("picks the highest rarity, then the highest value, and skips gone cards", () => {
    expect(bestSlot([drop("milspec", 900), drop("restricted", 1)])).toBe(1);
    expect(bestSlot([drop("covert", 10), drop("covert", 30)])).toBe(1);
    expect(bestSlot([drop("covert", 30), drop("covert", 30)])).toBe(0); // a tie keeps the left card
    expect(bestSlot([null, drop("milspec", 1)])).toBe(1);
    expect(bestSlot([drop("gold", 1), null])).toBe(0);
  });
});

describe("knifeSlot", () => {
  it("is the first card whose skin flips, or null", () => {
    const a = drop("covert", 1, "plain");
    const k1 = drop("gold", 1, "flip");
    const k2 = drop("gold", 1, "flip");
    const flips = (d: Drop) => d.skinId === "flip";
    expect(knifeSlot([a, k1], flips)).toBe(1);
    expect(knifeSlot([k1, k2], flips)).toBe(0);
    expect(knifeSlot([a, null], flips)).toBeNull();
  });
});

describe("centreOf", () => {
  it("is the middle of the points, or the fallback when there are none", () => {
    expect(centreOf([], { x: 5, y: 6 })).toEqual({ x: 5, y: 6 });
    expect(centreOf([{ x: 10, y: 70 }], { x: 0, y: 0 })).toEqual({ x: 10, y: 70 });
    expect(
      centreOf(
        [
          { x: 10, y: 70 },
          { x: 56, y: 70 },
        ],
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: 33, y: 70 });
  });
});

// Each slot shows, leaves and plays on its own; one knife flies at a time, and its card shows its empty face
// until the knife is back.
const tex = () => new Texture({ source: new TextureSource({ width: 1, height: 1 }) });
const skins = { frames: () => [tex(), tex()], fps: () => 8 } as unknown as SkinTextures;
const skin = {} as SkinDef;

describe("BenchCards", () => {
  it("shows, places and clears each slot on its own", () => {
    const cards = new BenchCards(skins, tex);
    cards.layout([
      { x: 30, y: 70 },
      { x: 76, y: 70 },
    ]);
    cards.show(1, skin, drop("gold", 1));
    cards.show(0, skin, drop("gold", 1));
    expect(cards.waiting()).toEqual([0, 1]);
    expect(cards.rect(1)).toEqual({ x: 54, y: 55, w: 44, h: 30 });
    cards.clear(0);
    expect(cards.waiting()).toEqual([1]);
    expect(cards.visible(0)).toBe(false);
    expect(cards.texture(1)).not.toBeNull();
    cards.clearAll();
    expect(cards.waiting()).toEqual([]);
    cards.destroy();
  });

  it("flies one knife: its card shows the empty face until it lands, and a knife card that leaves takes it along", () => {
    const cards = new BenchCards(skins, tex);
    cards.layout([
      { x: 30, y: 70 },
      { x: 76, y: 70 },
    ]);
    cards.show(0, skin, drop("gold", 1));
    cards.show(1, skin, drop("gold", 1));
    const face = cards.texture(1);
    cards.beginKnifeFlight(1);
    expect(cards.knifeOut).toBe(1);
    const empty = cards.texture(1);
    const other = cards.texture(0);
    expect(empty).not.toBe(face);
    cards.update(125, null); // a frame of the loop (8 fps): the empty face does not play while the knife is out
    expect(cards.texture(1)).toBe(empty);
    expect(cards.texture(0)).not.toBe(other); // the other card plays on
    cards.endKnifeFlight();
    expect(cards.knifeOut).toBeNull();
    expect(cards.texture(1)).toBe(face); // back in, from its first frame
    cards.beginKnifeFlight(1);
    cards.clear(1);
    expect(cards.knifeOut).toBeNull();
    cards.destroy();
  });

  it("releases a card's baked textures when it leaves", () => {
    const baked: Texture[] = [];
    const bake = () => {
      const t = tex();
      baked.push(t);
      return t;
    };
    const cards = new BenchCards(skins, bake);
    cards.layout([{ x: 30, y: 70 }]);
    cards.show(0, skin, drop("gold", 1));
    expect(baked.length).toBeGreaterThan(0);
    cards.clear(0);
    expect(baked.every((t) => t.destroyed)).toBe(true);
    expect(cards.texture(0)).toBeNull();
    cards.show(0, skin, drop("gold", 1)); // the slot shows again after it was released
    expect(cards.texture(0)).not.toBeNull();
    cards.destroy();
  });
});
