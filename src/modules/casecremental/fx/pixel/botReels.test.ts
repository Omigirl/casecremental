import { Container, Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createRng } from "../../sim/rng";
import type { SkinTextures } from "../skins/pixelSkin";
import { BotReels } from "./BotReels";
import { tableLayout } from "./layout";
import type { SpriteSet } from "./sprites";

// The bot's reels are made on the first layout that has a window for them (never in portrait): a reel made after
// the bot's spin started (a rotation, a resize) shows that spin's strip at once rather than an empty window.

const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
const frameSet = { frames: [tex] } as unknown as SpriteSet;
const skins = { texture: () => tex, size: () => ({ w: 26, h: 10 }), thumb: () => tex } as unknown as SkinTextures;
const portrait = tableLayout({ worldW: 180, worldH: 320, portrait: true });
const landscape = tableLayout({ worldW: 320, worldH: 180, portrait: false });

/** Reel i's strip of cards (a Reel: frame, thin, back, strip, clip, marker). */
const strip = (r: BotReels, i: number) => (r.root.children[i] as Container).children[3] as Container;

/** How many draw instructions the winner outline has on reel i (0 until it has landed). */
const edge = (r: BotReels, i: number) => {
  const s = strip(r, i);
  return (s.children[s.children.length - 1] as unknown as { context: { instructions: unknown[] } }).context.instructions.length;
};

describe("BotReels", () => {
  it("starts reels made after the spin began (portrait → landscape), and the spin carries on", () => {
    const ticks: number[] = [];
    const r = new BotReels(frameSet, skins, (i) => ticks.push(i));
    r.layout(portrait);
    r.setOnline(true);
    r.start("bootcamp", ["bc_woodland", "bc_desert"], createRng(1));
    expect(r.root.count).toBe(0); // no window, no reels
    r.layout(landscape);
    expect(r.root.count).toBe(2);
    expect(r.root.visible).toBe(true);
    for (const i of [0, 1]) expect(strip(r, i).children.length).toBeGreaterThan(0);
    expect(ticks).toEqual([]); // set straight onto its drops, quietly
    const landed = strip(r, 0).x;
    r.update({ caseId: "bootcamp", drops: [], elapsed: 0.5, duration: 3 });
    expect(strip(r, 0).x).toBeGreaterThan(landed); // back mid-spin, short of the landing
  });

  it("keeps one reel's window exactly the bot's reel rect (Run 1)", () => {
    const r = new BotReels(frameSet, skins, () => {});
    r.layout(landscape);
    r.start("bootcamp", ["bc_woodland"], createRng(1));
    expect(r.root.rect(0)).toEqual(landscape.bot.reel);
  });

  it("shows the landed look when the sim ends the spin without a frame at the end (spin cleared), once and silently", () => {
    const ticks: number[] = [];
    const r = new BotReels(frameSet, skins, (i) => ticks.push(i));
    r.layout(landscape);
    r.setOnline(true);
    r.start("bootcamp", ["bc_woodland"], createRng(1));
    r.update({ caseId: "bootcamp", drops: [], elapsed: 2.99, duration: 3 }); // the last spin frame stops short of 1
    expect(edge(r, 0)).toBe(0);
    ticks.length = 0;
    r.update(null); // the sim cleared the spin in the tick that finished it
    expect(edge(r, 0)).toBeGreaterThan(0);
    expect(ticks).toEqual([]);
  });
});

describe("BotReels free spin (The Last Case's finale)", () => {
  const setup = () => {
    const ticks: number[] = [];
    const r = new BotReels(frameSet, skins, (i) => ticks.push(i));
    r.layout(landscape);
    r.setOnline(true);
    r.start("bootcamp", ["bc_woodland", "bc_desert"], createRng(1));
    return { r, ticks };
  };

  it("ignores the sim's frames (null or a frozen spin) while free: no tick, no landing", () => {
    const { r, ticks } = setup();
    r.freeSpin("bootcamp", ["bc_woodland", "bc_desert"], createRng(2), false, 1, 3);
    const x = strip(r, 0).x;
    ticks.length = 0;
    r.update({ caseId: "bootcamp", drops: [], elapsed: 2.9, duration: 3 }); // the frozen spin
    expect(strip(r, 0).x).toBe(x);
    r.update(null);
    expect(edge(r, 0)).toBe(0); // not landed
    expect(strip(r, 0).x).toBe(x);
    expect(ticks).toEqual([]);
  });

  it("start() clears the flag: the sim's frames drive it again", () => {
    const { r } = setup();
    r.freeSpin("bootcamp", ["bc_woodland", "bc_desert"], createRng(2), false, 1, 3);
    r.start("bootcamp", ["bc_woodland", "bc_desert"], createRng(3));
    r.update({ caseId: "bootcamp", drops: [], elapsed: 2.99, duration: 3 });
    r.update(null);
    expect(edge(r, 0)).toBeGreaterThan(0); // landed by the sim's own clear
  });
});
