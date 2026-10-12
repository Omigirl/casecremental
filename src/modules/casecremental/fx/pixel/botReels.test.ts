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
const skins = { texture: () => tex } as unknown as SkinTextures;
const portrait = tableLayout({ worldW: 180, worldH: 320, portrait: true });
const landscape = tableLayout({ worldW: 320, worldH: 180, portrait: false });

/** Reel i's strip of cards (a Reel: frame, strip, clip, marker). */
const strip = (r: BotReels, i: number) => (r.root.children[i] as Container).children[1] as Container;

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
});
