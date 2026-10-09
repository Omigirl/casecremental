import type { Pt, Rect } from "../pixel/layout";
import { gridFont } from "./fitLabel";

// The vault's five reels as five wide beams fanning up out of the chest's mouth and running past the screen
// edge (spec 2026-10-09 §5). Pure geometry and stream maths, so the layout is tested without Pixi.

export interface Beam {
  /** The chest mouth, screen px. */
  origin: Pt;
  /** Radians from straight up; negative leans left. */
  angle: number;
  /** Screen px. */
  width: number;
  /** Screen px: the beam's whole far end (both its corners) is past the screen edge it points at. */
  length: number;
  /** Where the reward stops, and its distance from the origin along the beam. */
  spot: Pt;
  spotDist: number;
  /** The reward's icon box (screen px): the one asked for, or smaller when the screen is too crowded. */
  icon: number;
  /** The label's font size (screen px, on Press Start 2P's grid): a line's height. */
  font: number;
  /** The reward's label box (screen px) below its icon: the name over its +$, each a line `font` (label.h / 2) tall. */
  label: Rect;
  /** The label's backing plaque: the label box and headroom under the +$ for its descent and shadow. The layout
   *  keeps the plaque, not just the label, on screen and clear of everything. */
  plaque: Rect;
}

export interface BeamOptions {
  /** Boxes no icon or label may touch (screen px): the total, the chest. */
  keepOut?: readonly Rect[];
}

/** Degrees from straight up, left to right. */
export const BEAM_ANGLES_LANDSCAPE: readonly number[] = [-52, -26, 0, 26, 52];
export const BEAM_ANGLES_PORTRAIT: readonly number[] = [-34, -17, 0, 17, 34];
/** Yellow, orange, red, orange, yellow. */
export const BEAM_PALETTE: readonly number[] = [0xffd23c, 0xff8a1e, 0xe8362a, 0xff8a1e, 0xffd23c];
/** A beam's width at the mouth and at its far end, as shares of `width` (linear in between). */
export const BEAM_MOUTH_SHARE = 0.4;
export const BEAM_END_SHARE = 1.3;
/** A label is at least this many of its font's characters wide (a line is characters × font px): the longest
 *  name (20 characters) at the fitted floor (0.6) and the widest +$ ("+$999.9Qa", 9) both fit. */
export const LABEL_CHARS = 12.5;
/** Press Start 2P's full height in font sizes, the most any of its glyphs reaches: its 1000-unit ascent and its
 *  374-unit (Windows) descent, of 1000 units to the em. */
export const TEXT_BOX = 1.374;

/** The px a plaque reaches below its label: the +$ line's text box past its line, and its hard shadow
 *  (max(2, size / 8), hd/font). */
const headroom = (font: number): number => Math.ceil((TEXT_BOX - 1) * font + Math.max(2, font / 8));

const MARGIN = 4;
/** The space kept between two boxes, and around a keep-out (screen px). */
const GAP = 4;
/** Share of the way to the screen edge where each reward would rather stop: staggered so the labels clear. */
const SPOT_SHARE = [0.6, 0.5, 0.8, 0.5, 0.6];
/** How far past the edge a beam's far corners reach (screen px). */
const OVERSHOOT = 24;
/** Too crowded: the icons and labels shrink by this much and the search runs again. */
const SHRINK = 0.85;
const MAX_SHRINKS = 12;
/** Picks per search: a crowded screen gives up quickly and shrinks instead. */
const BUDGET = 400;
/** The centre beam first, then outward: mirrored pairs (one spot for both, reflected) when it can, else each
 *  beam on its own. */
const MIRRORED: readonly (readonly number[])[] = [[2], [1, 3], [0, 4]];
const SINGLE: readonly (readonly number[])[] = [[2], [1], [3], [0], [4]];

interface Cand {
  d: number;
  icon: Rect;
  /** The label's plaque (the label and its headroom): what the layout keeps clear. */
  plaque: Rect;
}

const hit = (a: Rect, b: Rect, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
const clash = (a: Cand, b: Cand) =>
  hit(a.icon, b.icon, GAP) || hit(a.plaque, b.plaque, GAP) || hit(a.plaque, b.icon, GAP) || hit(b.plaque, a.icon, GAP);

/** The length along `angle` from `o` at which the whole far end of a beam `hw` px half-wide (both its corners)
 *  is past the top or past the side it leans to, by OVERSHOOT, whichever comes first. */
function lengthOff(screen: { w: number; h: number }, o: Pt, angle: number, hw: number): number {
  const sx = Math.sin(angle);
  const cy = Math.cos(angle);
  let top = 0;
  let edge = 0;
  for (const side of [-1, 1]) {
    // the corner is at o + L·(sx, −cy) + side·hw·(cy, sx)
    top = Math.max(top, (o.y + side * sx * hw + OVERSHOOT) / cy);
    const x0 = o.x + side * cy * hw;
    edge = Math.max(edge, sx > 1e-9 ? (screen.w + OVERSHOOT - x0) / sx : sx < -1e-9 ? (x0 + OVERSHOOT) / -sx : Infinity);
  }
  return Math.min(top, edge);
}

/** icon: the streamed icon's box size (screen px); labelH: a label's two lines (screen px). Every icon and
 *  plaque is on screen, apart from the others and clear of the keep-outs; when no set of spots fits, the other
 *  fan's angles are tried, then the icons and labels shrink a step and the search runs again. */
export function beamLayout(screen: { w: number; h: number }, mouth: Pt, icon: number, labelH: number, opts: BeamOptions = {}): Beam[] {
  return fitBeams(screen, mouth, icon, labelH, opts).beams;
}

/** beamLayout with the search's verdict: `ok` is false only on its last resort (the last try's nearest spots,
 *  unchecked), which the tests' sweep of every window size proves is never reached. */
export function fitBeams(
  screen: { w: number; h: number },
  mouth: Pt,
  icon: number,
  labelH: number,
  opts: BeamOptions = {},
): { beams: Beam[]; ok: boolean } {
  const sets = screen.h > screen.w ? [BEAM_ANGLES_PORTRAIT, BEAM_ANGLES_LANDSCAPE] : [BEAM_ANGLES_LANDSCAPE, BEAM_ANGLES_PORTRAIT];
  const width = Math.max(icon * 1.4, Math.min(screen.w, screen.h) * 0.07);
  const keepOut = opts.keepOut ?? [];
  let last: Beam[] = [];
  for (let n = 0, f = 1; n <= MAX_SHRINKS; n++, f *= SHRINK)
    for (const degs of sets) {
      const got = solve(screen, mouth, degs, width, icon * f, gridFont((labelH * f) / 2), keepOut);
      if (got.ok) return got;
      last = got.beams;
    }
  return { beams: last, ok: false };
}

function solve(
  screen: { w: number; h: number },
  mouth: Pt,
  degs: readonly number[],
  width: number,
  icon: number,
  font: number,
  keepOut: readonly Rect[],
): { ok: boolean; beams: Beam[] } {
  const angles = degs.map((d) => (d * Math.PI) / 180);
  const labelW = Math.max(icon * 1.8, LABEL_CHARS * font);
  const plaqueH = 2 * font + headroom(font);
  const fits = (r: Rect) => r.x >= MARGIN && r.y >= MARGIN && r.x + r.w <= screen.w - MARGIN && r.y + r.h <= screen.h - MARGIN;
  const clear = (r: Rect) => fits(r) && keepOut.every((k) => !hit(r, k, GAP));
  const minDist = icon * 1.2;
  const boxes = (angle: number, d: number): Cand => {
    const x = mouth.x + Math.sin(angle) * d;
    const y = mouth.y - Math.cos(angle) * d;
    return {
      d,
      icon: { x: x - icon / 2, y: y - icon / 2, w: icon, h: icon },
      plaque: { x: x - labelW / 2, y: y + icon / 2, w: labelW, h: plaqueH },
    };
  };

  // every distance along each beam (a fine sweep) where its icon and label are on screen and clear of the
  // keep-outs, nearest the wanted share of the way to the edge first
  const domains = angles.map((angle, i) => {
    const sx = Math.sin(angle);
    const tx = sx > 1e-9 ? (screen.w - mouth.x) / sx : sx < -1e-9 ? -mouth.x / sx : Infinity;
    const exit = Math.min(tx, mouth.y / Math.cos(angle));
    const share = SPOT_SHARE[i] ?? 0.6;
    const cands: Cand[] = [];
    for (let d = exit * 0.95; d >= minDist; d -= icon * 0.08) {
      const c = boxes(angle, d);
      if (clear(c.icon) && clear(c.plaque)) cands.push(c);
    }
    return cands.sort((p, q) => Math.abs(p.d / exit - share) - Math.abs(q.d / exit - share));
  });

  // a group's candidates: one spot per beam in it; a mirrored pair shares its distance, the second reflected
  const tuples = (group: readonly number[]): Cand[][] => {
    const [first, second] = group;
    const own = domains[first!] ?? [];
    if (second === undefined) return own.map((c) => [c]);
    const out: Cand[][] = [];
    for (const c of own) {
      const m = boxes(angles[second]!, c.d);
      if (clear(m.icon) && clear(m.plaque) && !clash(c, m)) out.push([c, m]);
    }
    return out;
  };

  // backtracking with forward checking, a group at a time: each pick prunes the groups still to place; it gives
  // up after BUDGET picks
  const pick: (Cand | undefined)[] = [];
  const place = (groups: readonly (readonly number[])[]): boolean => {
    let picks = 0;
    const search = (n: number, doms: Cand[][][]): boolean => {
      const group = groups[n];
      if (group === undefined) return true;
      for (const t of doms[n] ?? []) {
        if (++picks > BUDGET) return false;
        const next = doms.slice();
        let ok = true;
        for (let m = n + 1; m < groups.length && ok; m++) {
          const left = (doms[m] ?? []).filter((o) => o.every((x) => t.every((c) => !clash(c, x))));
          next[m] = left;
          ok = left.length > 0;
        }
        if (!ok) continue;
        group.forEach((i, k) => (pick[i] = t[k]));
        if (search(n + 1, next)) return true;
      }
      return false;
    };
    return search(0, groups.map(tuples));
  };
  const ok = place(MIRRORED) || place(SINGLE);

  const beams = angles.map((angle, i) => {
    const c = (ok ? pick[i] : domains[i]?.[0]) ?? boxes(angle, minDist);
    return {
      origin: { ...mouth },
      angle,
      width,
      length: lengthOff(screen, mouth, angle, (width * BEAM_END_SHARE) / 2),
      spot: { x: c.icon.x + icon / 2, y: c.icon.y + icon / 2 },
      spotDist: c.d,
      icon,
      font,
      label: { ...c.plaque, h: 2 * font },
      plaque: c.plaque,
    };
  });
  return { ok, beams };
}

/** Item j's distance from the origin along its beam when the strip is at p (cells, from columnMotion), so that
 *  item `target` sits at spotDist when p = target: (p − target) × spacing + spotDist + (target − j) × spacing.
 *  Items with a distance < 0 are still inside the chest (hidden). */
export function itemDistance(p: number, j: number, target: number, spacing: number, spotDist: number): number {
  return (p - target) * spacing + spotDist + (target - j) * spacing;
}
