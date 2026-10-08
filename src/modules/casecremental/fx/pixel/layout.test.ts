import { describe, expect, it } from "vitest";
import { ITEM_SIZE, PANEL_CHROME, tableLayout, type Rect } from "./layout";
import { hdFontSize } from "./screen";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [[1920, 1080], [1280, 720], [3440, 1440], [800, 450], [1366, 768], [390, 844], [820, 1180], [1084, 749], [1159, 777], [1440, 900], [2560, 1440]];
const box = (cx: number, bottom: number, w: number, h: number): Rect => ({ x: cx - w / 2, y: bottom - h, w, h });
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

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
  };

  it("keeps every item on the table and inside the world", () => {
    const world: Rect = { x: 0, y: 0, w: l.worldW, h: l.worldH };
    expect(inside(l.table, world)).toBe(true);
    for (const [name, r] of Object.entries(items)) expect(inside(r, { ...l.table, y: l.table.y - 60, h: l.table.h + 60 }), name).toBe(true);
  });

  it("never lets items overlap (except the case on its mat)", () => {
    const names = Object.keys(items).filter((n) => n !== "case");
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
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
    const card = { x: l.you.reveal.x - ITEM_SIZE.reveal.w / 2, y: l.you.reveal.y - ITEM_SIZE.reveal.h / 2, w: ITEM_SIZE.reveal.w, h: ITEM_SIZE.reveal.h };
    expect(card.y).toBeGreaterThanOrEqual(l.you.reel.y + l.you.reel.h);
    expect(card.y + card.h).toBeLessThanOrEqual(l.you.mat.y + 4);
  });
});
