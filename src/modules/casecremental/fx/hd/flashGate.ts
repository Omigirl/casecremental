// Photosensitivity is a hard rule (spec §7, M2b): at most three full-screen flashes in any one second. The table's
// full-screen flash (HdLayer.flash) asks this gate first, so a ★ on your bench, a stage-up, a station's power-on
// and a grid breakout can never stack past the limit.

export const MAX_FLASHES_PER_SECOND = 3;

export class FlashGate {
  private starts: number[] = [];

  /** True (and counted) when a flash may start at `now` (seconds). */
  take(now: number): boolean {
    this.starts = this.starts.filter((t) => now - t < 1);
    if (this.starts.length >= MAX_FLASHES_PER_SECOND) return false;
    this.starts.push(now);
    return true;
  }
}
