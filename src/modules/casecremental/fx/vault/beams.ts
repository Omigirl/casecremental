import type { Pt, Rect } from "../pixel/layout";

// The vault's five reels as five wide beams fanning up out of the chest's mouth and running past the screen
// edge (spec 2026-10-09 §5). Pure geometry and stream maths, so the layout is tested without Pixi.

export interface Beam {
  /** The chest mouth, screen px. */
  origin: Pt;
  /** Radians from straight up; negative leans left. */
  angle: number;
  /** Screen px. */
  width: number;
  /** Screen px: reaches past the screen edge the beam points at. */
  length: number;
  /** Where the reward stops, and its distance from the origin along the beam. */
  spot: Pt;
  spotDist: number;
  /** The reward's label box (screen px), beside or below its icon. */
  label: Rect;
}

/** Degrees from straight up, left to right. */
export const BEAM_ANGLES_LANDSCAPE: readonly number[] = [-52, -26, 0, 26, 52];
export const BEAM_ANGLES_PORTRAIT: readonly number[] = [-34, -17, 0, 17, 34];
/** Yellow, orange, red, orange, yellow. */
export const BEAM_PALETTE: readonly number[] = [0xffd23c, 0xff8a1e, 0xe8362a, 0xff8a1e, 0xffd23c];

const MARGIN = 4;
/** Share of the way to the screen edge where each reward stops: staggered so the labels clear each other. */
const SPOT_SHARE = [0.6, 0.5, 0.8, 0.5, 0.6];
/** How far past the edge a beam reaches (screen px). */
const OVERSHOOT = 48;

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** icon: the streamed icon's box size (screen px); labelH: a label's height (screen px). */
export function beamLayout(screen: { w: number; h: number }, mouth: Pt, icon: number, labelH: number): Beam[] {
  const angles = (screen.h > screen.w ? BEAM_ANGLES_PORTRAIT : BEAM_ANGLES_LANDSCAPE).map((d) => (d * Math.PI) / 180);
  const labelW = icon * 1.8;
  const width = Math.max(icon * 1.4, Math.min(screen.w, screen.h) * 0.07);

  const spotAt = (a: number, d: number): Pt => ({ x: mouth.x + Math.sin(a) * d, y: mouth.y - Math.cos(a) * d });
  const iconBox = (p: Pt): Rect => ({ x: p.x - icon / 2, y: p.y - icon / 2, w: icon, h: icon });
  const labelBox = (p: Pt): Rect => ({ x: p.x - labelW / 2, y: p.y + icon / 2, w: labelW, h: labelH });
  const fits = (r: Rect) => r.x >= MARGIN && r.y >= MARGIN && r.x + r.w <= screen.w - MARGIN && r.y + r.h <= screen.h - MARGIN;
  const boxesOf = (a: number, d: number) => {
    const p = spotAt(a, d);
    return { icon: iconBox(p), label: labelBox(p) };
  };

  const minDist = icon * 1.2;
  // each beam's exit distance, and every distance along it where the icon and its label are on screen, nearest
  // the wanted share first
  const rays = angles.map((angle, i) => {
    const sx = Math.sin(angle);
    const tx = sx > 1e-9 ? (screen.w - mouth.x) / sx : sx < -1e-9 ? -mouth.x / sx : Infinity;
    const exit = Math.min(tx, mouth.y / Math.cos(angle));
    const share = SPOT_SHARE[i] ?? 0.6;
    const cands: number[] = [];
    for (let d = exit * 0.95; d >= minDist; d -= icon * 0.08) {
      const b = boxesOf(angle, d);
      if (fits(b.icon) && fits(b.label)) cands.push(d);
    }
    cands.sort((p, q) => Math.abs(p / exit - share) - Math.abs(q / exit - share));
    return { angle, exit, cands, dist: cands[0] ?? minDist };
  });

  // pick one per beam so no icon or label touches another's: backtracking, the centre beam first
  const clash = (i: number, di: number, j: number, dj: number) => {
    const a = boxesOf(rays[i]?.angle ?? 0, di);
    const b = boxesOf(rays[j]?.angle ?? 0, dj);
    return hit(a.icon, b.icon) || hit(a.label, b.label) || hit(a.label, b.icon) || hit(b.label, a.icon);
  };
  const ORDER = [2, 1, 3, 0, 4];
  const chosen = new Map<number, number>();
  const solve = (n: number): boolean => {
    const i = ORDER[n];
    if (i === undefined) return true;
    for (const d of rays[i]?.cands ?? []) {
      let ok = true;
      for (const [j, dj] of chosen) if (clash(i, d, j, dj)) ok = false;
      if (!ok) continue;
      chosen.set(i, d);
      if (solve(n + 1)) return true;
      chosen.delete(i);
    }
    return false;
  };
  if (solve(0)) for (const [i, d] of chosen) if (rays[i]) rays[i].dist = d;

  return rays.map(({ angle, exit, dist }) => {
    const spot = spotAt(angle, dist);
    return {
      origin: { ...mouth },
      angle,
      width,
      length: exit + OVERSHOOT,
      spot,
      spotDist: dist,
      label: labelBox(spot),
    };
  });
}

/** Item j's distance from the origin along its beam when the strip is at p (cells, from columnMotion), so that
 *  item `target` sits at spotDist when p = target: (p − target) × spacing + spotDist + (target − j) × spacing.
 *  Items with a distance < 0 are still inside the chest (hidden). */
export function itemDistance(p: number, j: number, target: number, spacing: number, spotDist: number): number {
  return (p - target) * spacing + spotDist + (target - j) * spacing;
}
