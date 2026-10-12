import { describe, expect, it } from "vitest";
import { skinName } from "../../i18n/content";
import { setLang } from "../../i18n/index";
import { CASES, VAULT_LEGEND } from "../../sim/content/cases";
import type { Rect } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import { endCornersOff } from "./beamTestKit";
import { fitLabel, LABEL_MIN_SHARE } from "./fitLabel";
import { OPEN_H, VAULT_FRAME, vaultLayout } from "./vaultLayout";

const SCREENS = [
  { w: 1920, h: 1080 },
  { w: 1324, h: 824 },
  { w: 1324, h: 768 },
  { w: 390, h: 844 },
];

function layoutFor(screen: { w: number; h: number }) {
  const vp = pixelViewport(screen.w, screen.h);
  return { vp, v: vaultLayout(screen, vp.scale) };
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the vault's layout (chest at lower centre, the beams out of it, the total above the lid)", () => {
  it.each(SCREENS)("puts everything on screen at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    const c = v.chest;
    expect(c.x).toBe(screen.w / 2);
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeLessThanOrEqual(screen.h);
    expect((VAULT_FRAME.w * c.S) / 2).toBeLessThanOrEqual(screen.w / 2);
    expect(v.beams).toHaveLength(5);
    expect(v.totalAt.x).toBe(screen.w / 2);
    expect(v.totalAt.y).toBeGreaterThan(0);
    expect(v.totalAt.y).toBeLessThan(screen.h);
    // the key phase's vault and key are on screen too
    expect(v.key.bottom.y).toBeLessThanOrEqual(screen.h);
    expect(v.key.bottom.y - OPEN_H * v.key.S).toBeGreaterThanOrEqual(0);
    expect(v.key.home.x).toBeGreaterThan(0);
  });

  it.each(SCREENS)("fans the beams out of the open chest, its rewards above the lid, at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    for (const b of v.beams) {
      expect(b.origin.x).toBe(v.chest.x);
      expect(b.origin.y).toBeGreaterThan(v.chest.top);
      expect(b.origin.y).toBeLessThan(v.chest.bottom);
      expect(b.spot.y + v.icon / 2).toBeLessThan(v.chest.top);
      expect(b.label.y + b.label.h).toBeLessThan(v.chest.top);
    }
  });

  it.each(SCREENS)("keeps the total between the lid and the rewards, clear of every icon and label, at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    // the widest total, "ИТОГО +$999.9Qa": 15 characters of a monospaced font, at its count-up pop (×1.25)
    const size = 1.25 * v.totalSize;
    const total: Rect = { x: v.totalAt.x - 7.5 * size, y: v.totalAt.y - size / 2, w: 15 * size, h: size };
    expect(total.y + total.h).toBeLessThan(v.chest.top);
    for (const b of v.beams) {
      const icon = { x: b.spot.x - v.icon / 2, y: b.spot.y - v.icon / 2, w: v.icon, h: v.icon };
      expect(hit(total, icon)).toBe(false);
      expect(hit(total, b.label)).toBe(false);
    }
  });

  it.each(SCREENS)("sizes the open chest to ~28 % of the height with a whole-number scale, at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    expect(Number.isInteger(v.chest.S)).toBe(true);
    const share = (OPEN_H * v.chest.S) / screen.h;
    expect(share).toBeGreaterThan(0.22);
    expect(share).toBeLessThan(0.34);
  });

  it("sits the chest's bottom at ~88 % of the height in landscape and ~80 % in portrait", () => {
    expect(layoutFor(SCREENS[0]!).v.chest.bottom / 1080).toBeCloseTo(0.88, 2);
    expect(layoutFor(SCREENS[2]!).v.chest.bottom / 768).toBeCloseTo(0.88, 2);
    expect(layoutFor(SCREENS[3]!).v.chest.bottom / 844).toBeCloseTo(0.8, 2);
  });
});

// Phones held either way and an ultrawide (C7): the key phase's vault, key and hint, and the open chest with
// the total over it, all on screen and apart. The rewards are checked in the sweep below, which includes these.
const EDGE_SCREENS = [
  { w: 844, h: 390 },
  { w: 640, h: 360 },
  { w: 568, h: 320 },
  { w: 360, h: 640 },
  { w: 3440, h: 1440 },
];

describe("the vault's layout on phones and an ultrawide", () => {
  it.each(EDGE_SCREENS)("keeps the key phase and the open chest on screen and apart at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    const on = (x: number, y: number) => x >= 0 && x <= screen.w && y >= 0 && y <= screen.h;
    // the waiting vault, the devil key beside it and the hint under them
    const k = v.key;
    expect(on(k.bottom.x - (VAULT_FRAME.w * k.S) / 2, k.bottom.y - OPEN_H * k.S)).toBe(true);
    expect(on(k.bottom.x + (VAULT_FRAME.w * k.S) / 2, k.bottom.y)).toBe(true);
    expect(on(k.home.x, k.home.y)).toBe(true);
    expect(on(k.bottom.x, k.hintY)).toBe(true);
    // the open chest, and the total at its widest pop between the screen's top and the lid
    const c = v.chest;
    expect(on(c.x - (VAULT_FRAME.w * c.S) / 2, c.top)).toBe(true);
    expect(on(c.x + (VAULT_FRAME.w * c.S) / 2, c.bottom)).toBe(true);
    const size = 1.25 * v.totalSize;
    expect(v.totalAt.y - size / 2).toBeGreaterThanOrEqual(0);
    expect(v.totalAt.y + size / 2).toBeLessThan(c.top);
    expect(v.beams).toHaveLength(5);
  });
});

// A sweep of window sizes, landscape and portrait (final review, Important 1-3 and Minor 1): the five rewards,
// their icons and labels, on screen and apart, clear of the total and the chest, each beam's far end off
// screen, and every name and +$ fitting its label box.
const SWEEP = [
  ...[640, 960, 1366, 1920, 2560, 3840].flatMap((w) => [360, 720, 1080, 1440, 2160].map((h) => ({ w, h }))),
  { w: 1324, h: 824 },
  { w: 1324, h: 768 },
  { w: 2560, h: 1440 },
  { w: 3440, h: 1440 },
  { w: 3840, h: 2160 },
  { w: 768, h: 1024 },
  { w: 1080, h: 1200 },
  { w: 1280, h: 1380 },
  { w: 960, h: 1032 },
  { w: 960, h: 1040 },
  { w: 960, h: 1000 },
  { w: 785, h: 873 },
  { w: 1173, h: 1229 },
  { w: 360, h: 640 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 844, h: 390 },
  { w: 667, h: 375 },
  { w: 568, h: 320 },
];
const MARGIN = 4;
/** The widest +$ a vault pays out. */
const WIDEST_MONEY = "+$999.9Qa";

describe("the vault's layout over a sweep of window sizes", () => {
  const names = (() => {
    const ids = [...CASES[CASES.length - 1]!.skins.map((s) => s.id), VAULT_LEGEND.id];
    const out: string[] = [];
    for (const lang of ["en", "ru"] as const) {
      setLang(lang);
      out.push(...ids.map(skinName));
    }
    setLang("en");
    return out;
  })();

  it("keeps every reward on screen, apart, clear of the total and the chest, with the beams' ends off screen and every label fitting", () => {
    const t0 = performance.now();
    const fails: string[] = [];
    for (const screen of SWEEP) {
      const { v } = layoutFor(screen);
      const at = `${screen.w}×${screen.h}`;
      const size = 1.25 * v.totalSize;
      const total: Rect = { x: v.totalAt.x - 7.5 * size, y: v.totalAt.y - size / 2, w: 15 * size, h: size };
      const chest: Rect = {
        x: v.chest.x - (VAULT_FRAME.w * v.chest.S) / 2,
        y: v.chest.top,
        w: VAULT_FRAME.w * v.chest.S,
        h: v.chest.bottom - v.chest.top,
      };
      const boxes = v.beams.map((b) => ({
        icon: { x: b.spot.x - v.icon / 2, y: b.spot.y - v.icon / 2, w: v.icon, h: v.icon },
        label: b.label,
      }));
      const inside = (r: Rect) => r.x >= MARGIN && r.y >= MARGIN && r.x + r.w <= screen.w - MARGIN && r.y + r.h <= screen.h - MARGIN;
      boxes.forEach((bx, i) => {
        for (const [what, r] of [
          ["icon", bx.icon],
          ["label", bx.label],
        ] as const) {
          if (!inside(r)) fails.push(`${at} ${what} ${i} off screen`);
          if (hit(r, total)) fails.push(`${at} ${what} ${i} on the total`);
          if (hit(r, chest)) fails.push(`${at} ${what} ${i} on the chest`);
        }
        boxes.forEach((o, j) => {
          if (i < j && hit(bx.icon, o.icon)) fails.push(`${at} icon ${i} × icon ${j}`);
          if (i < j && hit(bx.label, o.label)) fails.push(`${at} label ${i} × label ${j}`);
          if (i !== j && hit(bx.label, o.icon)) fails.push(`${at} label ${i} × icon ${j}`);
        });
      });
      v.beams.forEach((b, i) => {
        if (!endCornersOff(b, screen)) fails.push(`${at} beam ${i}'s end shows`);
        const base = b.label.h / 2;
        if ([...WIDEST_MONEY].length * base > b.label.w) fails.push(`${at} +$ wider than label ${i}`);
        for (const name of names) {
          const f = fitLabel([name], b.label.w, 1, base, base * LABEL_MIN_SHARE);
          if (f.overflow || f.lines.length !== 1) fails.push(`${at} "${name}" overflows label ${i}`);
        }
      });
    }
    expect(fails.slice(0, 12)).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
