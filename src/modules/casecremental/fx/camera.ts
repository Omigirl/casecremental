// The camera, shared by the canvas and the React overlay: the World writes where it pushes in (the
// reveal card, in screen px), its shake offset and its zoom every frame; the overlay's HUD and
// panels apply the same transform, so a big moment zooms the whole screen, not just the table.

export interface CameraState {
  focusX: number;
  focusY: number;
  dx: number;
  dy: number;
  zoom: number;
}

const same = (a: CameraState, b: CameraState) =>
  a.focusX === b.focusX && a.focusY === b.focusY && a.dx === b.dx && a.dy === b.dy && a.zoom === b.zoom;

export class Camera {
  private state: CameraState = { focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 };
  private readonly listeners = new Set<(s: CameraState) => void>();

  get current(): CameraState {
    return this.state;
  }

  set(s: CameraState): void {
    if (same(s, this.state)) return;
    this.state = { ...s };
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn: (s: CameraState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** The CSS for DOM drawn over the canvas: scale around the focus, then the shake offset. */
export function cameraCss(s: CameraState): { transformOrigin: string; transform: string } {
  const still = s.zoom === 1 && s.dx === 0 && s.dy === 0;
  return {
    transformOrigin: `${s.focusX}px ${s.focusY}px`,
    transform: still ? "none" : `translate(${s.dx}px, ${s.dy}px) scale(${s.zoom})`,
  };
}

/** A canvas point (screen px) where the camera shows it: the transform cameraCss gives the DOM, for one point
 *  (finish spec §4: the tutorial points at props on the table from outside the camera's lens). */
export function cameraPoint(s: CameraState, p: { x: number; y: number }): { x: number; y: number } {
  return { x: s.focusX + (p.x - s.focusX) * s.zoom + s.dx, y: s.focusY + (p.y - s.focusY) * s.zoom + s.dy };
}
