// How far a dragged item tilts: it leans into the drag in proportion to its (smoothed) speed, at
// most MAX_LEAN, and settles upright when it stops — the 2.5D "picked up" feel.

export const MAX_LEAN = 0.3; // radians

export class Lean {
  private vx = 0;
  private angle = 0;
  private last: number | null = null;

  reset(x: number): void {
    this.last = x;
    this.vx = 0;
    this.angle = 0;
  }

  /** x in screen px, dt in seconds → rotation in radians (positive = clockwise, moving right). */
  update(x: number, dt: number): number {
    if (dt <= 0) return this.angle;
    const v = this.last === null ? 0 : (x - this.last) / dt;
    this.last = x;
    this.vx += (v - this.vx) * Math.min(1, dt * 12);
    const want = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, this.vx * 0.0005));
    this.angle += (want - this.angle) * Math.min(1, dt * 14);
    return this.angle;
  }
}
