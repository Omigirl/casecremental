import { describe, expect, it } from "vitest";
import { REEL_MAX_H } from "../pixel/BenchReels";
import { benchReelArea, tableLayout } from "../pixel/layout";
import { REEL_FRAME } from "../pixel/drawn";
import { pixelViewport } from "../pixel/viewport";
import { SKIN_H, SKIN_W } from "../skins/motion";
import { fitArt } from "../skins/thumb";
import { stackRects } from "../vault/stackedReels";
import { STRIP_LENGTH, WIN_INDEX } from "./strip";
import { ART_CELL_W, cellLook, SLICE_MIN_H } from "./cellLook";
import { reelPosition } from "../pixel/Reel";

// F1 #3: every stacked strip shows distinct cells — the full art, the art shrunk, or clean rarity tiles — never art
// cut by the clip, never a squashed nine-slice frame.

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [1000, 1000],
  [390, 844],
  [360, 640],
];

describe("cellLook", () => {
  it("keeps the single 26-px reel exactly as it was: the nine-slice frame, 30-px cards, the full art over a 2-px bar", () => {
    expect(cellLook(26)).toEqual({ frame: "slice", inset: 3, cellW: ART_CELL_W, gap: 2, bar: 2, artBox: { w: 28, h: 18 } });
  });

  it("draws a thin frame below 16 px, where the 6-px nine-slice would squash into noise", () => {
    for (let h = 1; h <= 40; h++) expect(cellLook(h).frame, `h=${h}`).toBe(h >= SLICE_MIN_H ? "slice" : "thin");
    expect(SLICE_MIN_H).toBeGreaterThan(2 * REEL_FRAME.border);
  });

  it("shrinks the art on a short strip and draws plain tiles where even that would not read", () => {
    expect(cellLook(15).artBox).toEqual({ w: 28, h: 11 });
    expect(cellLook(11)).toMatchObject({ frame: "thin", cellW: 24, bar: 1, artBox: { w: 22, h: 8 } });
    expect(cellLook(9).artBox).toEqual({ w: 22, h: 6 });
    expect(cellLook(7).artBox).toBeNull();
    expect(cellLook(6).artBox).toBeNull();
  });

  it("keeps the art and its bar inside the window and a cell", () => {
    for (let h = 5; h <= 40; h++) {
      const c = cellLook(h);
      if (!c.artBox) continue;
      expect(c.artBox.h + c.bar).toBeLessThanOrEqual(h - 2 * c.inset);
      expect(c.artBox.w).toBeLessThanOrEqual(c.cellW - c.gap);
    }
  });

  it("lands a fake tease's sliver on the card, never on the gap, at every cell width (strip.ts: up to 0.43 of a card)", () => {
    for (const h of [5, 9, 11, 15, 26]) {
      const c = cellLook(h);
      expect(0.43 * c.cellW + 0.5).toBeLessThanOrEqual((c.cellW - c.gap) / 2);
    }
  });

  it("covers the whole window with strip, at the start and on landing, for windows up to 300 px wide", () => {
    for (const h of [6, 11, 26]) {
      const { cellW } = cellLook(h);
      for (const w of [120, 200, 300])
        for (const f of [0, 1]) {
          const { x } = reelPosition(f, w, f ? 0.43 : 0, cellW);
          expect(x).toBeLessThanOrEqual(0);
          expect(x + STRIP_LENGTH * cellW).toBeGreaterThanOrEqual(w);
          if (f) expect(reelPosition(f, w, 0, cellW).index).toBe(WIN_INDEX);
        }
    }
  });
});

describe("the bench's stacked reels at every viewport (F1 #3, Review Focus 2)", () => {
  it.each(SIZES)(
    "show full art at ×2–×3 and readable shrunk art at ×5 while spinning, at least clean tiles once landed, at %ix%i",
    (w, h) => {
      const l = tableLayout(pixelViewport(w, h));
      for (const n of [2, 3, 5]) {
        for (const r of stackRects(benchReelArea(l, n, true), n, REEL_MAX_H)) {
          const c = cellLook(r.h);
          expect(c.artBox, `×${n} tall h=${r.h}`).not.toBeNull();
          const fit = fitArt(SKIN_W, SKIN_H, c.artBox!);
          if (n <= 3) expect(fit).toEqual({ w: SKIN_W, h: SKIN_H });
          else expect(fit.h).toBeGreaterThanOrEqual(5);
        }
        for (const r of stackRects(benchReelArea(l, n, false), n, REEL_MAX_H)) {
          expect(r.h, `×${n} compact`).toBeGreaterThanOrEqual(5);
          expect(r.h - 2 * cellLook(r.h).inset).toBeGreaterThanOrEqual(3); // a tile at least 3 px tall
        }
      }
    },
  );
});
