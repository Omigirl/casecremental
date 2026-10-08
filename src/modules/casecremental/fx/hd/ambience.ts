// Pure motion for the room's ambience: the lamp's flicker and drifting dust motes (spec §6 idle
// layer). Deterministic, so it can be tested and never syncs with anything else.

/** Lamp brightness at time t (s): a slow breathe plus a rare short dip, always within [0.78, 1]. */
export function lampFlicker(t: number): number {
  const breathe = 0.04 * Math.sin(t * 1.7) + 0.03 * Math.sin(t * 4.3 + 1.1);
  const dipPhase = (t * 0.23) % 1;
  const dip = dipPhase > 0.97 ? 0.12 * Math.sin(((dipPhase - 0.97) / 0.03) * Math.PI) : 0;
  return Math.min(1, Math.max(0.78, 0.93 + breathe - dip));
}

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Make n motes spread over the box with slow drift, from a [0,1) random source. */
export function makeMotes(n: number, box: Box, random: () => number): Mote[] {
  return Array.from({ length: n }, () => ({
    x: box.x + random() * box.w,
    y: box.y + random() * box.h,
    vx: (random() - 0.5) * 6,
    vy: -2 - random() * 4,
    phase: random() * Math.PI * 2,
  }));
}

/** Drift each mote (with a gentle sway) and wrap it around inside the box. */
export function stepMotes(motes: Mote[], dt: number, box: Box, t: number): void {
  for (const m of motes) {
    m.x += (m.vx + 3 * Math.sin(t * 0.8 + m.phase)) * dt;
    m.y += m.vy * dt;
    if (m.y < box.y) m.y += box.h;
    if (m.y > box.y + box.h) m.y -= box.h;
    if (m.x < box.x) m.x += box.w;
    if (m.x > box.x + box.w) m.x -= box.w;
  }
}
