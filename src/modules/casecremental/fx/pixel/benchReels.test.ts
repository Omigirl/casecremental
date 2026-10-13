import { describe, expect, it } from "vitest";
import type { Bench, BenchReel } from "../../sim/run";
import type { Drop } from "../../sim/types";
import { Texture, TextureSource, type Container } from "pixi.js";
import { caseById } from "../../sim/content/cases";
import { createRng } from "../../sim/rng";
import type { SkinTextures } from "../skins/pixelSkin";
import { BenchReels, earlyLandings, leanHeld, leanReel, tallWindow } from "./BenchReels";
import { tableLayout } from "./layout";
import type { SpriteSet } from "./sprites";

// Multi-open's stacked reels each carry their own tease; the camera leans toward the strongest one.

const reel = (strength: number | null, duration = 3): BenchReel => ({
  drop: { id: 1, caseId: "bootcamp", skinId: "x", rarity: "milspec", float: 0.1, wear: "MW", statTrak: false, value: 1 } as Drop,
  tease: strength === null ? null : { strength, fake: null, extraSeconds: 1 },
  duration,
});

describe("leanReel", () => {
  it("is null when no reel teases", () => {
    expect(leanReel([])).toBeNull();
    expect(leanReel([reel(null), reel(null)])).toBeNull();
  });

  it("is the reel with the strongest tease, the first among equals", () => {
    expect(leanReel([reel(null), reel(0.4)])).toBe(1);
    expect(leanReel([reel(0.9), reel(0.4)])).toBe(0);
    expect(leanReel([reel(0.4), reel(0.9)])).toBe(1);
    expect(leanReel([reel(0.5), reel(0.5)])).toBe(0);
  });
});

describe("earlyLandings", () => {
  // a plain reel lands at 3 s; its teasing partner crawls on to 5 s and lands with the reveal
  const pair = [reel(null, 3), reel(0.8, 5)];

  it("is the reels that land between two frames, before the last one (the reveal's own landing)", () => {
    expect(earlyLandings(pair, 2.9, 3.05)).toEqual([0]);
    expect(earlyLandings(pair, 2.5, 2.9)).toEqual([]); // not yet
    expect(earlyLandings(pair, 3.05, 3.1)).toEqual([]); // once only
    expect(earlyLandings(pair, 4.9, 5.1)).toEqual([]); // the last lands with the reveal
  });

  it("lands every reel of the same frame together, and none when they all land at once", () => {
    expect(earlyLandings([reel(null, 3), reel(null, 3), reel(0.5, 6)], 2.9, 3)).toEqual([0, 1]);
    expect(earlyLandings([reel(null, 3), reel(null, 3)], 2.9, 3.1)).toEqual([]);
    expect(earlyLandings([reel(null, 3)], 2.9, 3.1)).toEqual([]);
  });
});

describe("leanHeld", () => {
  it("keeps the camera on the leaned-to reel until that reel lands", () => {
    const pair = [reel(0.9, 6), reel(null, 3)];
    expect(leanHeld(pair, 0, 5.9)).toBe(0);
    expect(leanHeld(pair, 0, 6)).toBeNull();
    expect(leanHeld(pair, null, 1)).toBeNull();
  });

  it("lets go of a teasing reel that lands before a slower partner", () => {
    const pair = [reel(0.4, 4), reel(null, 7)];
    expect(leanHeld(pair, 0, 3.9)).toBe(0);
    expect(leanHeld(pair, 0, 4.5)).toBeNull();
  });
});

describe("tallWindow", () => {
  it("is tall only while more than one reel spins, and snaps back to compact once they land", () => {
    const spinning = (n: number): Bench => ({
      phase: "spinning",
      caseId: "bootcamp",
      reels: Array.from({ length: n }, () => reel(null)),
      elapsed: 1,
      fullDuration: 3,
    });
    expect(tallWindow(spinning(2))).toBe(true);
    expect(tallWindow(spinning(1))).toBe(false);
    expect(tallWindow({ phase: "revealed", caseId: "bootcamp", cards: [reel(null).drop, reel(null).drop] })).toBe(false);
    expect(tallWindow({ phase: "locked", caseId: "bootcamp", free: false, count: 2 })).toBe(false);
    expect(tallWindow({ phase: "empty" })).toBe(false);
  });
});

describe("BenchReels landing", () => {
  const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
  const frameSet = { frames: [tex] } as unknown as SpriteSet;
  const skins = { texture: () => tex, size: () => ({ w: 26, h: 10 }), thumb: () => tex } as unknown as SkinTextures;
  const edge = (r: BenchReels) => {
    const strip = (r.root.children[0] as Container).children[3] as Container;
    return (strip.children[strip.children.length - 1] as unknown as { context: { instructions: unknown[] } }).context.instructions.length;
  };
  const setup = () => {
    const ticks: number[] = [];
    const r = new BenchReels(frameSet, skins, (i) => ticks.push(i));
    r.layout(tableLayout({ worldW: 320, worldH: 180, portrait: false }));
    const base = reel(0.8, 5);
    const reels = [{ ...base, drop: { ...base.drop, skinId: "bc_woodland" } }];
    r.start("bootcamp", reels, createRng(1));
    return { r, reels, ticks };
  };
  const spinning = (reels: BenchReel[], elapsed: number) => ({ phase: "spinning", caseId: "bootcamp", reels, elapsed }) as unknown as Bench;
  const revealed = (reels: BenchReel[]) => ({ phase: "revealed", caseId: "bootcamp", cards: [reels[0]!.drop] }) as unknown as Bench;

  it("lands the reels on the first frame after the spin, though no frame reached fraction 1 (a tease, a slow frame)", () => {
    const { r, reels, ticks } = setup();
    r.update(spinning(reels, 4.99));
    expect(edge(r)).toBe(0);
    ticks.length = 0;
    r.update(revealed(reels));
    expect(edge(r)).toBeGreaterThan(0);
    expect(ticks).toEqual([]); // landing is silent: the early-landing and reveal sounds are the World's
  });

  it("stays landed on later frames, and a revealed frame with no spin before it (a reload) leaves the reels to start()", () => {
    const { r, reels } = setup();
    r.update(revealed(reels));
    expect(edge(r)).toBe(0);
    r.update(spinning(reels, 4.99));
    r.update(revealed(reels));
    r.update(revealed(reels));
    expect(edge(r)).toBeGreaterThan(0);
  });
});

describe("BenchReels free spin (The Last Case's finale)", () => {
  const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
  const frameSet = { frames: [tex] } as unknown as SpriteSet;
  const skins = { texture: () => tex, size: () => ({ w: 26, h: 10 }), thumb: () => tex } as unknown as SkinTextures;
  const c = caseById("bootcamp");
  const setup = () => {
    const ticks: number[] = [];
    const r = new BenchReels(frameSet, skins, (i) => ticks.push(i));
    r.layout(tableLayout({ worldW: 320, worldH: 180, portrait: false }));
    return { r, ticks };
  };
  const strip = (r: BenchReels) => (r.root.children[0] as Container).children[3] as Container;
  const edge = (r: BenchReels) => {
    const s = strip(r);
    return (s.children[s.children.length - 1] as unknown as { context: { instructions: unknown[] } }).context.instructions.length;
  };
  const frozen = (): Bench =>
    ({ phase: "spinning", caseId: "bootcamp", reels: [reel(0.9, 3)], elapsed: 2.9, fullDuration: 3 }) as unknown as Bench;

  it("ignores the bench's frames while free: no lean, no landing, no tick, the strip stays", () => {
    const { r, ticks } = setup();
    r.freeSpin(c, c.skins[0]!, createRng(1), true, 1, 3);
    const x = strip(r).x;
    ticks.length = 0;
    expect(r.update(frozen())).toEqual({ lean: null, landed: [] });
    expect(r.update({ phase: "empty" })).toEqual({ lean: null, landed: [] });
    expect(strip(r).x).toBe(x);
    expect(edge(r)).toBe(0);
    expect(ticks).toEqual([]);
  });

  it("start() clears the flag: the bench reacts again", () => {
    const { r } = setup();
    r.freeSpin(c, c.skins[0]!, createRng(1), true, 1, 3);
    const base = reel(0.9, 3);
    r.start("bootcamp", [{ ...base, drop: { ...base.drop, skinId: "bc_woodland" } }], createRng(2));
    const b = {
      phase: "spinning",
      caseId: "bootcamp",
      reels: [{ ...base, drop: { ...base.drop, skinId: "bc_woodland" } }],
      elapsed: 2.9,
      fullDuration: 3,
    } as unknown as Bench;
    expect(r.update(b).lean).not.toBeNull(); // the tease leans in again
  });
});
