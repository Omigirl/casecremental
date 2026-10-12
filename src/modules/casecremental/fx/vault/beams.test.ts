import { describe, expect, it } from "vitest";
import type { Rect } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import { pixelViewport } from "../pixel/viewport";
import { BEAM_ANGLES_LANDSCAPE, BEAM_ANGLES_PORTRAIT, beamLayout, fitBeams, itemDistance, TEXT_BOX } from "./beams";
import { endCornersOff } from "./beamTestKit";
import { BEAM_ICON, BEAM_MOUTH, OPEN_H, VAULT_FRAME, vaultLayout } from "./vaultLayout";
import { VAULT_LOOKS } from "./vaultLooks";

const SCREENS = [
  { w: 1920, h: 1080 },
  { w: 1324, h: 824 },
  { w: 1324, h: 768 },
  { w: 390, h: 844 },
];
const MARGIN = 4;

function setup(screen: { w: number; h: number }) {
  const vp = pixelViewport(screen.w, screen.h);
  const v = vaultLayout(screen, vp.scale);
  const mouth = { x: v.chest.x, y: v.chest.top + 6 * v.chest.S };
  const icon = 2 * 16 * vp.scale;
  const labelH = 2 * hdFontSize(vp.scale);
  return { beams: beamLayout(screen, mouth, icon, labelH), mouth, icon, labelH };
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const iconBox = (b: { spot: { x: number; y: number } }, icon: number): Rect => ({
  x: b.spot.x - icon / 2,
  y: b.spot.y - icon / 2,
  w: icon,
  h: icon,
});
const inside = (r: Rect, s: { w: number; h: number }) =>
  r.x >= MARGIN && r.y >= MARGIN && r.x + r.w <= s.w - MARGIN && r.y + r.h <= s.h - MARGIN;

describe("the vault's beams", () => {
  it("has a palette per vault and angles for five beams", () => {
    for (const look of Object.values(VAULT_LOOKS)) expect(look.palette, look.id).toHaveLength(5);
    expect(BEAM_ANGLES_LANDSCAPE).toHaveLength(5);
    expect(BEAM_ANGLES_PORTRAIT).toHaveLength(5);
  });

  describe.each(SCREENS)("at $w×$h", (screen) => {
    const { beams, mouth, icon } = setup(screen);

    it("fans five beams symmetrically about the mouth", () => {
      expect(beams).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(beams[i].origin).toEqual(mouth);
        expect(beams[i].angle + beams[4 - i].angle).toBeCloseTo(0, 9);
      }
      expect(beams[2].angle).toBeCloseTo(0, 9);
      expect(beams[0].angle).toBeLessThan(beams[4].angle);
    });

    it("runs each beam past the screen edge, both corners of its far end off screen", () => {
      for (const b of beams) {
        const x = b.origin.x + Math.sin(b.angle) * b.length;
        const y = b.origin.y - Math.cos(b.angle) * b.length;
        expect(x < 0 || x > screen.w || y < 0 || y > screen.h).toBe(true);
        expect(endCornersOff(b, screen)).toBe(true);
      }
    });

    it("keeps every spot and label on screen, above the mouth", () => {
      for (const b of beams) {
        expect(inside(iconBox(b, icon), screen)).toBe(true);
        expect(inside(b.label, screen)).toBe(true);
        expect(b.spot.y).toBeLessThan(mouth.y);
        expect(b.spotDist).toBeCloseTo(Math.hypot(b.spot.x - mouth.x, b.spot.y - mouth.y), 6);
      }
    });

    it("keeps icons and labels from overlapping", () => {
      const boxes = beams.map((b) => ({ icon: iconBox(b, icon), label: b.label }));
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          if (i < j) {
            expect(hit(boxes[i].icon, boxes[j].icon)).toBe(false);
            expect(hit(boxes[i].label, boxes[j].label)).toBe(false);
          }
          if (i !== j) expect(hit(boxes[i].label, boxes[j].icon)).toBe(false);
        }
    });
  });
});

// Every window from a small phone to a 4K screen, both ways up (C7): 33 widths × 32 heights.
const EXHAUSTIVE = Array.from({ length: 33 }, (_, i) => 320 + i * 110).flatMap((w) =>
  Array.from({ length: 32 }, (_, j) => ({ w, h: 320 + j * 59 })),
);

/** The beams of the vault at this screen, solved again from the layout's own inputs (the mouth, the icon, the
 *  label's lines, the total at its widest pop and the chest as keep-outs), with the solver's verdict. */
function solvedAt(screen: { w: number; h: number }) {
  const k = pixelViewport(screen.w, screen.h).scale;
  const v = vaultLayout(screen, k);
  const pop = 1.25 * v.totalSize;
  const keepOut: Rect[] = [
    { x: v.chest.x - 7.5 * pop, y: v.totalAt.y - pop / 2, w: 15 * pop, h: pop },
    { x: v.chest.x - (VAULT_FRAME.w * v.chest.S) / 2, y: v.chest.top, w: VAULT_FRAME.w * v.chest.S, h: OPEN_H * v.chest.S },
  ];
  const mouth = { x: v.chest.x, y: v.chest.top + BEAM_MOUTH * v.chest.S };
  return { v, keepOut, got: fitBeams(screen, mouth, BEAM_ICON * k, 2 * hdFontSize(k), { keepOut }) };
}

describe("the beams' layout over every window size", () => {
  const all = EXHAUSTIVE.map((screen) => ({ screen, ...solvedAt(screen) }));

  it(`never falls back to an unsolved layout (${EXHAUSTIVE.length} sizes, fast)`, () => {
    expect(EXHAUSTIVE.length).toBeGreaterThanOrEqual(1000);
    const t0 = performance.now();
    for (const screen of EXHAUSTIVE) solvedAt(screen);
    expect(performance.now() - t0).toBeLessThan(3000);
    const unsolved = all.filter((a) => !a.got.ok).map((a) => `${a.screen.w}×${a.screen.h}`);
    expect(unsolved).toEqual([]);
    // the same inputs as the vault's layout: its beams are these
    for (const a of all.slice(0, 40)) expect(a.v.beams).toEqual(a.got.beams);
  });

  it("puts the rewards of beams 1 and 3 (and 0 and 4) at mirrored spots", () => {
    const lopsided = all
      .filter(({ got: { beams: b } }) => b[1]!.spotDist !== b[3]!.spotDist || b[0]!.spotDist !== b[4]!.spotDist)
      .map((a) => `${a.screen.w}×${a.screen.h}`);
    expect(lopsided).toEqual([]);
    for (const { got } of all.slice(0, 40)) {
      const [b0, b1, , b3, b4] = got.beams;
      expect(b1!.spot.x + b3!.spot.x).toBeCloseTo(2 * b1!.origin.x, 6);
      expect(b1!.spot.y).toBeCloseTo(b3!.spot.y, 6);
      expect(b0!.spot.y).toBeCloseTo(b4!.spot.y, 6);
    }
  });

  it("keeps each label's font on Press Start 2P's grid: a multiple of 8, else whole px", () => {
    const off: string[] = [];
    for (const { screen, got } of all)
      for (const b of got.beams) {
        const onGrid = b.font % 8 === 0 || (Number.isInteger(b.font) && b.font < 8 && b.font >= 1);
        if (!onGrid || b.label.h !== 2 * b.font) off.push(`${screen.w}×${screen.h} font ${b.font}`);
      }
    expect(off.slice(0, 8)).toEqual([]);
  });

  it("backs each label with a plaque that covers the +$ line's whole text box, its shadow included, on screen and apart", () => {
    const fails: string[] = [];
    for (const { screen, got, keepOut } of all) {
      const at = `${screen.w}×${screen.h}`;
      got.beams.forEach((b, i) => {
        const p = b.plaque;
        // the +$ line starts a line down; Pixi's text box is TEXT_BOX font sizes tall, the hard shadow below it
        const moneyBottom = b.label.y + b.font + TEXT_BOX * b.font + Math.max(2, b.font / 8);
        if (p.x !== b.label.x || p.w !== b.label.w || p.y !== b.label.y) fails.push(`${at} plaque ${i} not on its label`);
        if (p.y + p.h < moneyBottom) fails.push(`${at} plaque ${i} short of the +$ by ${moneyBottom - p.y - p.h}`);
        if (!inside(p, screen)) fails.push(`${at} plaque ${i} off screen`);
        if (keepOut.some((k) => hit(p, k))) fails.push(`${at} plaque ${i} on the total or the chest`);
        got.beams.forEach((o, j) => {
          if (i < j && hit(p, o.plaque)) fails.push(`${at} plaque ${i} × plaque ${j}`);
          if (i !== j && hit(p, iconBox(o, o.icon))) fails.push(`${at} plaque ${i} × icon ${j}`);
        });
      });
    }
    expect(fails.slice(0, 8)).toEqual([]);
  });
});

describe("itemDistance", () => {
  it("puts the target on the spot when the strip is at the target", () => {
    expect(itemDistance(30, 30, 30, 90, 400)).toBe(400);
  });
  it("puts larger j nearer the chest and smaller j further out", () => {
    expect(itemDistance(30, 31, 30, 90, 400)).toBeLessThan(400);
    expect(itemDistance(30, 29, 30, 90, 400)).toBeGreaterThan(400);
    expect(itemDistance(30, 31, 30, 90, 400)).toBe(310);
  });
  it("moves items outward as the strip advances, and hides items still in the chest", () => {
    expect(itemDistance(10, 5, 30, 90, 400)).toBeGreaterThan(itemDistance(9, 5, 30, 90, 400));
    expect(itemDistance(0, 5, 30, 90, 400)).toBeLessThan(0);
  });
});
