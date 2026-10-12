import { describe, expect, it } from "vitest";
import {
  benchReelArea,
  botReelArea,
  botRevealSpots,
  ITEM_SIZE,
  lockerCardSpots,
  PANEL_CHROME,
  revealSpots,
  tableLayout,
  type Pt,
  type Rect,
} from "./layout";
import { traySlots } from "./traySlots";
import { hdFontSize } from "./screen";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [
  // narrow landscape: 4:3 tablets, 5:4 monitors, near-square windows (final review)
  [1024, 768],
  [1280, 1024],
  [2732, 2048],
  [1000, 1000],
  [1312, 1080],
  [900, 860],
  [1920, 1080],
  [1280, 720],
  [3440, 1440],
  [800, 450],
  [1366, 768],
  [390, 844],
  [820, 1180],
  [1084, 749],
  [1159, 777],
  [1440, 900],
  [2560, 1440],
];
const box = (cx: number, bottom: number, w: number, h: number): Rect => ({ x: cx - w / 2, y: bottom - h, w, h });
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const cardBox = (p: Pt): Rect => ({
  x: p.x - ITEM_SIZE.reveal.w / 2,
  y: p.y - ITEM_SIZE.reveal.h / 2,
  w: ITEM_SIZE.reveal.w,
  h: ITEM_SIZE.reveal.h,
});

describe.each(SIZES)("tableLayout at %i×%i", (w, h) => {
  const vp = pixelViewport(w, h);
  const l = tableLayout(vp);
  const items: Record<string, Rect> = {
    mat: l.you.mat,
    case: box(l.you.caseSpot.x, l.you.caseSpot.y, ITEM_SIZE.case.w, ITEM_SIZE.case.h),
    key: box(l.you.keyHome.x, l.you.keyHome.y + 5, ITEM_SIZE.key.w, ITEM_SIZE.key.h),
    bot: box(l.bot.spot.x, l.bot.spot.y, ITEM_SIZE.bot.w, ITEM_SIZE.bot.h),
    tray: l.tray,
    seller: box(l.seller.x, l.seller.y, ITEM_SIZE.seller.w, ITEM_SIZE.seller.h),
    bin: { x: l.bin.x - l.binR, y: l.bin.y - l.binR, w: l.binR * 2, h: l.binR * 2 },
    locker: l.locker,
  };

  it("keeps every item on the table and inside the world", () => {
    const world: Rect = { x: 0, y: 0, w: l.worldW, h: l.worldH };
    expect(inside(l.table, world)).toBe(true);
    for (const [name, r] of Object.entries(items)) expect(inside(r, { ...l.table, y: l.table.y - 60, h: l.table.h + 60 }), name).toBe(true);
  });

  it("never lets items overlap (except the case on its mat)", () => {
    const names = Object.keys(items).filter((n) => n !== "case");
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        expect(overlap(items[names[i]!]!, items[names[j]!]!), `${names[i]} × ${names[j]}`).toBe(false);
      }
    expect(inside(items.case!, { ...l.you.mat, y: l.you.mat.y - 20, h: l.you.mat.h + 20 })).toBe(true);
  });

  it("keeps panels clear of the table and the reels below the HUD", () => {
    for (const p of [l.panelL, l.panelR]) if (p) expect(overlap(p, l.table)).toBe(false);
    expect(l.you.reel.y).toBeGreaterThanOrEqual(l.hudH);
    if (vp.portrait) expect(l.panelL).toBeNull();
  });

  it("gives the side panels room for an 11-character line of text", () => {
    // Press Start 2P is monospaced: a character is hdFontSize CSS px = hdFontSize / scale world px.
    const charW = hdFontSize(vp.scale) / vp.scale;
    for (const p of [l.panelL, l.panelR]) if (p) expect((p.w - PANEL_CHROME) / charW).toBeGreaterThanOrEqual(11);
  });

  it("puts the reveal card above the mat and below the reel", () => {
    const card = {
      x: l.you.reveal.x - ITEM_SIZE.reveal.w / 2,
      y: l.you.reveal.y - ITEM_SIZE.reveal.h / 2,
      w: ITEM_SIZE.reveal.w,
      h: ITEM_SIZE.reveal.h,
    };
    expect(card.y).toBeGreaterThanOrEqual(l.you.reel.y + l.you.reel.h);
    expect(card.y + card.h).toBeLessThanOrEqual(l.you.mat.y + 4);
  });

  it("leaves room for the hint between the reel and a single card, except in portrait (where it is dropped)", () => {
    // the hint sits 2 px under the reel, one line of hdFontSize CSS px tall (World.updateText, labels.hintKey)
    const hintBottom = l.you.reel.y + l.you.reel.h + 2 + hdFontSize(vp.scale) / vp.scale;
    const cardTop = l.you.reveal.y - ITEM_SIZE.reveal.h / 2;
    expect(hintBottom <= cardTop).toBe(!vp.portrait);
  });
  it("puts the bot's card on the table, clear of your reveal card", () => {
    const r = l.bot.reveal;
    const { w: cw } = ITEM_SIZE.reveal;
    expect(r.x - cw / 2).toBeGreaterThanOrEqual(l.table.x);
    expect(r.x + cw / 2).toBeLessThanOrEqual(l.table.x + l.table.w);
    expect(Math.abs(r.x - l.you.reveal.x)).toBeGreaterThanOrEqual(cw); // the two cards don't overlap
    expect(r.x).toBeLessThanOrEqual(l.bot.spot.x - 10); // the bot's face stays visible beside it
  });
  it("stands the locker on the front edge, between the tray and the bin", () => {
    expect([l.locker.w, l.locker.h]).toEqual([ITEM_SIZE.locker.w, ITEM_SIZE.locker.h]);
    expect(l.locker.x).toBeGreaterThanOrEqual(l.tray.x + l.tray.w + 2);
    expect(l.locker.x + l.locker.w).toBeLessThanOrEqual(l.bin.x - l.binR - 2);
    expect(l.locker.y + l.locker.h).toBe(l.bin.y + l.binR);
  });

  it("keeps every tray slot between the seller and the locker, even at the widest capacity", () => {
    const seller = items.seller!;
    for (const capacity of [12, 18, 24])
      for (const s of traySlots(l.tray, capacity)) {
        expect(s.x).toBeGreaterThanOrEqual(seller.x + seller.w);
        expect(s.x + s.w).toBeLessThanOrEqual(l.locker.x);
      }
  });

  it("sets the locker's results on the locker, on the table, clear of the stations and of the other cards", () => {
    const others = [1, 2].flatMap((n) => [...revealSpots(l, n), ...botRevealSpots(l, n)]).map(cardBox);
    for (const n of [1, 2])
      for (const p of lockerCardSpots(l, n)) {
        const c = cardBox(p);
        expect(c.x).toBeGreaterThanOrEqual(l.table.x);
        expect(c.x + c.w).toBeLessThanOrEqual(l.table.x + l.table.w);
        expect(overlap(c, l.locker)).toBe(true); // it sits on the cabinet
        for (const name of ["bot", "seller", "mat", "key", "case"]) expect(overlap(c, items[name]!), name).toBe(false);
        for (const o of others) expect(overlap(c, o)).toBe(false);
      }
  });

  it("gives the bot a second card to the right of its first, never past the table or onto your cards", () => {
    const [a, b] = botRevealSpots(l, 2) as [Pt, Pt];
    expect(botRevealSpots(l, 1)).toEqual([l.bot.reveal]);
    expect(a).toEqual(l.bot.reveal);
    expect(b.y).toBe(a.y);
    expect(b.x - a.x).toBeGreaterThanOrEqual(6);
    expect(b.x - a.x).toBeLessThanOrEqual(ITEM_SIZE.reveal.w + 2);
    expect(b.x + ITEM_SIZE.reveal.w / 2).toBeLessThanOrEqual(l.table.x + l.table.w - 1);
    for (const q of [...revealSpots(l, 1), ...revealSpots(l, 2)]) expect(overlap(cardBox(b), cardBox(q))).toBe(false);
  });

  it("stacks the bot's double spin above its cards' spot, clear of your cards (no reel in portrait)", () => {
    const area = botReelArea(l, 2);
    if (vp.portrait) {
      expect(area).toBeNull();
      return;
    }
    expect(botReelArea(l, 1)).toEqual(l.bot.reel);
    expect(area!.y).toBe(l.bot.reel!.y);
    expect(area!.h).toBeGreaterThanOrEqual(l.bot.reel!.h);
    expect(area!.y + area!.h).toBeLessThanOrEqual(l.bot.reveal.y - ITEM_SIZE.reveal.h / 2 - 2);
    for (const q of [...revealSpots(l, 1), ...revealSpots(l, 2)]) expect(overlap(area!, cardBox(q))).toBe(false);
  });
});

describe("multi-open on the table", () => {
  for (const vp of [pixelViewport(1920, 1080), pixelViewport(390, 844)]) {
    const l = tableLayout(vp);
    const name = vp.portrait ? "portrait" : "landscape";
    it(`one card sits on you.reveal (${name})`, () => {
      expect(revealSpots(l, 1)).toEqual([l.you.reveal]);
      expect(benchReelArea(l, 1, true)).toEqual(l.you.reel);
      expect(benchReelArea(l, 1, false)).toEqual(l.you.reel);
    });
    it(`two cards stay on the table, left of the bot's card (Review Focus 5, ${name})`, () => {
      const [a, b] = revealSpots(l, 2) as [Pt, Pt];
      const w = ITEM_SIZE.reveal.w;
      expect(a.x).toBeLessThan(b.x);
      expect(a.x - w / 2).toBeGreaterThanOrEqual(l.table.x);
      expect(b.x + w / 2).toBeLessThanOrEqual(l.bot.reveal.x - w / 2);
      expect(a.y).toBe(l.you.reveal.y);
      expect(b.y).toBe(l.you.reveal.y);
      expect(Number.isInteger(a.x) && Number.isInteger(b.x)).toBe(true);
    });
    it(`the tall window spans the reel's top to above the mat and never covers the case (${name})`, () => {
      const tall = benchReelArea(l, 2, true);
      expect(tall.y).toBe(l.you.reel.y);
      expect(tall.h).toBeGreaterThan(l.you.reel.h);
      expect(tall.y + tall.h).toBeLessThanOrEqual(l.you.mat.y - 1);
      const compact = benchReelArea(l, 2, false);
      expect(compact.y + compact.h).toBeLessThanOrEqual(l.you.reveal.y - ITEM_SIZE.reveal.h / 2);
    });
  }
  it.each(SIZES)("two cards fit beside each other or overlap, never past their limits, at %ix%i", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    const cw = ITEM_SIZE.reveal.w;
    const [a, b] = revealSpots(l, 2) as [Pt, Pt];
    expect(a.x - cw / 2).toBeGreaterThanOrEqual(l.table.x + 1);
    expect(b.x + cw / 2).toBeLessThanOrEqual(l.bot.reveal.x - cw / 2 - 1);
    expect(b.x - a.x).toBeLessThanOrEqual(cw + 2);
    expect(b.x).toBeGreaterThan(a.x);
  });
});
