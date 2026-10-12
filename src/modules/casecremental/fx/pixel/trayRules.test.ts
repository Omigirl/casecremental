import { describe, expect, it } from "vitest";
import { fitArt } from "../skins/thumb";
import { glows, popLook, slideAt, slotArtBox, throb, TRAY_LOOK, TrayMotion } from "./trayRules";

// F1 #4: the claim tray comes alive — cards slide in from where they were and hop onto their slot, a claimed card pops
// out, Covert and ★ glow softly, a full tray pulses its frame red. All pure, so a reload and a resize come out right.

const { slide, bounce, pop } = TRAY_LOOK;

describe("slideAt", () => {
  const from = { x: 40, y: 60 };
  const to = { x: 120, y: 160 };

  it("starts where the card was and reaches its slot after the slide, in whole px", () => {
    expect(slideAt(from, to, 0)).toEqual(from);
    expect(slideAt(from, to, slide)).toEqual(to);
    for (let t = 0; t < slide + bounce; t += 0.01) {
      const p = slideAt(from, to, t)!;
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    }
  });

  it("arcs up on the way, then hops at most 2 px on the slot and settles", () => {
    const mid = slideAt(from, to, slide / 2)!;
    const e = 1 - 0.5 ** 3;
    expect(mid.y).toBeLessThan(from.y + (to.y - from.y) * e);
    for (let t = slide; t < slide + bounce; t += 0.01) {
      const p = slideAt(from, to, t)!;
      expect(p.x).toBe(to.x);
      expect(p.y).toBeLessThanOrEqual(to.y);
      expect(p.y).toBeGreaterThanOrEqual(to.y - TRAY_LOOK.hop);
    }
    expect(slideAt(from, to, slide + bounce)).toBeNull();
  });
});

describe("popLook", () => {
  it("grows to 1.6× and fades out over 0.25 s, then is gone", () => {
    expect(popLook(0)).toEqual({ scale: 1, alpha: 1 });
    let last = popLook(0)!;
    for (let t = 0.02; t < pop; t += 0.02) {
      const l = popLook(t)!;
      expect(l.scale).toBeGreaterThan(last.scale);
      expect(l.alpha).toBeLessThan(last.alpha);
      expect(l.scale).toBeLessThanOrEqual(1 + TRAY_LOOK.popGrow);
      last = l;
    }
    expect(popLook(pop)).toBeNull();
  });
});

describe("the tray's pulses and photosensitivity", () => {
  it("swing by less than 0.1 from peak to peak (the BEAT_LIGHT_AMPLITUDES rule), whatever the time", () => {
    for (const p of [TRAY_LOOK.glow, TRAY_LOOK.full]) {
      expect(p.swing).toBeLessThan(0.1);
      let lo = Infinity;
      let hi = -Infinity;
      for (let t = 0; t < 5; t += 0.01) {
        lo = Math.min(lo, throb(t, p));
        hi = Math.max(hi, throb(t, p));
      }
      expect(hi - lo).toBeLessThan(0.1);
      expect((hi + lo) / 2).toBeCloseTo(p.base, 2);
    }
  });

  it("glow only for Covert and ★", () => {
    expect(glows("covert")).toBe(true);
    expect(glows("gold")).toBe(true);
    for (const r of ["milspec", "restricted", "classified"] as const) expect(glows(r)).toBe(false);
  });
});

describe("slotArtBox", () => {
  it("is the slot inside its 1-px edge, and a skin fits it keeping its shape", () => {
    expect(slotArtBox({ x: 5, y: 5, w: 10, h: 7 })).toEqual({ w: 8, h: 5 });
    expect(slotArtBox({ x: 0, y: 0, w: 3, h: 3 })).toEqual({ w: 1, h: 1 });
    expect(fitArt(26, 10, slotArtBox({ x: 0, y: 0, w: 10, h: 7 }))).toEqual({ w: 8, h: 3 });
  });
});

describe("TrayMotion", () => {
  const centre = (i: number) => ({ x: 100 + i * 11, y: 160 });

  it("animates nothing on its first frame — a reload or a new World with a full tray (Review Focus 5)", () => {
    const m = new TrayMotion();
    m.arriving(3, { x: 0, y: 0 });
    expect(m.update([1, 2, 3], 0.016, centre)).toEqual([]);
    expect(m.slides.size).toBe(0);
    expect(m.pops).toEqual([]);
  });

  it("slides a stored card in from its spot, reports its landing once, and lets it settle", () => {
    const m = new TrayMotion();
    m.update([1], 0.016, centre);
    m.arriving(2, { x: 40, y: 60 });
    m.update([1, 2], 0.016, centre);
    expect(m.flying(2)).toBe(true);
    expect(m.slides.get(2)!.from).toEqual({ x: 40, y: 60 });
    expect(m.update([1, 2], slide - 0.05, centre)).toEqual([]);
    expect(m.update([1, 2], 0.1, centre)).toEqual([2]);
    expect(m.update([1, 2], 0.01, centre)).toEqual([]);
    m.update([1, 2], bounce, centre);
    expect(m.flying(2)).toBe(false);
  });

  it("shows a card with no spot to come from (the grid's) in place, without a slide", () => {
    const m = new TrayMotion();
    m.update([], 0.016, centre);
    m.update([7], 0.016, centre);
    expect(m.flying(7)).toBe(false);
  });

  it("pops a claimed card at its slot when tapped, at the drop point when dragged; a card stored away does not pop", () => {
    const m = new TrayMotion();
    m.update([1, 2, 3], 0.016, centre);
    m.claimed(2, null);
    m.claimed(3, { x: 300, y: 170 });
    m.update([1], 0.016, centre);
    expect(m.pops.map((p) => [p.id, p.at, p.dragged])).toEqual([
      [2, centre(1), false],
      [3, { x: 300, y: 170 }, true],
    ]);
    m.update([], 0.016, centre); // card 1 went to the locker: no claim, no pop
    expect(m.pops.map((p) => p.id)).toEqual([2, 3]);
    m.update([], pop, centre);
    expect(m.pops).toEqual([]);
  });

  it("pops a card claimed while it is still sliding in, instead of finishing the slide (Review Focus 4)", () => {
    const m = new TrayMotion();
    m.update([], 0.016, centre);
    m.arriving(5, { x: 40, y: 60 });
    m.update([5], 0.016, centre);
    m.claimed(5, null);
    expect(m.update([], 0.05, centre)).toEqual([]);
    expect(m.flying(5)).toBe(false);
    expect(m.pops.map((p) => p.id)).toEqual([5]);
  });

  it("settles everything at once on a resize: no slide finishes later, no landing sound, no pop (Review Focus 3)", () => {
    const m = new TrayMotion();
    m.update([1], 0.016, centre);
    m.arriving(2, { x: 40, y: 60 });
    m.claimed(1, null);
    m.update([2], 0.016, centre);
    m.settle();
    expect(m.slides.size).toBe(0);
    expect(m.pops).toEqual([]);
    expect(m.update([2], 1, centre)).toEqual([]);
  });
});
