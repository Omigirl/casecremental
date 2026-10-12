import type { Rng } from "../../sim/rng";
import type { Bench as BenchState, BenchReel } from "../../sim/run";
import { caseById, skinById } from "../../sim/content/cases";
import type { CaseDef, SkinDef } from "../../sim/types";
import { crawlSeconds } from "../reel/motion";
import type { SkinTextures } from "../skins/pixelSkin";
import { StackedReels, stackRects } from "../vault/stackedReels";
import { benchReelArea, type Pt, type Rect, type TableLayout } from "./layout";
import type { SpriteSet } from "./sprites";

// Your bench's reels (multi-open: stacked, one per case, each landing its own drop with its own tease). While
// more than one spins the window is tall — the cards are not up yet — and it snaps back to compact once they have
// all landed: Reel.layout rebuilds the whole strip, so it is not glided frame by frame. A reel that lands before
// its teasing partner gets its own (quieter) stop; the camera leans toward the strongest tease until that reel lands.

/** The tallest one reel gets in a stack. */
export const REEL_MAX_H = 26;

/** The camera leans in when the strongest tease starts its crawl. */
export interface ReelLean {
  /** 0–1: how deep. */
  strength: number;
  /** Seconds left until that reel lands. */
  seconds: number;
}

/** The reel the camera leans toward: the strongest tease (the first among equals), or null when none teases. */
export function leanReel(reels: readonly BenchReel[]): number | null {
  let best: number | null = null;
  reels.forEach((r, i) => {
    if (r.tease && (best === null || r.tease.strength > reels[best]!.tease!.strength)) best = i;
  });
  return best;
}

/** The reels that land between two frames (elapsed `from` → `to`), before the last landing — the reveal's own. */
export function earlyLandings(reels: readonly BenchReel[], from: number, to: number): number[] {
  const last = Math.max(...reels.map((r) => r.duration));
  return reels.flatMap((r, i) => (r.duration < last && r.duration > from && r.duration <= to ? [i] : []));
}

/** The reel the camera still leans toward: the one it leaned to, until that reel lands. */
export function leanHeld(reels: readonly BenchReel[], leaned: number | null, elapsed: number): number | null {
  const r = leaned === null ? undefined : reels[leaned];
  return r && elapsed < r.duration ? leaned : null;
}

/** The window is tall while more than one reel spins; it snaps back to compact once they have landed. */
export const tallWindow = (b: BenchState): boolean => b.phase === "spinning" && b.reels.length > 1;

/** One frame of the reels: the camera's lean (the first frame the strongest tease crawls), and the reels that
 *  landed this frame before the last one. */
export interface ReelFrame {
  lean: ReelLean | null;
  landed: number[];
}

export class BenchReels {
  readonly root: StackedReels;
  private l: TableLayout | null = null;
  private n = 1;
  private tall = false;
  /** The reel the camera has leaned toward this spin, or null. */
  private leaned: number | null = null;
  /** Whether that reel is still spinning (the camera lets go when it lands). */
  private leaning = false;
  /** Last frame's elapsed time of this spin (null until its first frame: a reload lands nothing). */
  private lastElapsed: number | null = null;
  /** Whether a spin frame was shown since the last start: the first frame after it snaps the reels to their landing. */
  private spun = false;
  /** The Last Case's free spin has the reel (freeSpin) until the next open: the bench's own frames leave it alone. */
  private free = false;

  constructor(frameSet: SpriteSet, skins: SkinTextures, onTick: (i: number) => void) {
    this.root = new StackedReels(frameSet, skins, onTick);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.apply();
  }

  /** The window the reels sit in now (the hint goes under it). */
  get area(): Rect | null {
    return this.l ? benchReelArea(this.l, this.n, this.tall) : null;
  }

  /** A single idle reel (the bench before the first spin). */
  idle(c: CaseDef, winner: SkinDef, rng: Rng): void {
    this.n = 1;
    this.tall = false;
    this.apply();
    this.root.start(0, c, winner, rng);
  }

  /** A new open (or a reload mid-spin): one reel per case, each with its own drop and tease. */
  start(caseId: string, reels: readonly BenchReel[], rng: Rng): void {
    this.n = Math.max(1, reels.length);
    this.tall = this.n > 1;
    this.free = false;
    this.leaned = null;
    this.leaning = false;
    this.lastElapsed = null;
    this.spun = false;
    this.apply();
    const c = caseById(caseId);
    reels.forEach((r, i) => this.root.start(i, c, skinById(r.drop.skinId), rng, r.tease));
  }

  /** The Last Case's free spin (Finale.ts): one reel of the vault's source case, landing as the lid opens. */
  freeSpin(c: CaseDef, winner: SkinDef, rng: Rng, start: boolean, elapsed: number, duration: number): void {
    if (start) this.idle(c, winner, rng);
    this.free = true;
    this.root.update(0, { elapsed, fullDuration: duration, crawl: 0 });
  }

  /** Move every reel: the lean (the first frame the strongest tease is into its crawl) and the early landings. */
  update(b: BenchState): ReelFrame {
    if (this.free) return { lean: null, landed: [] };
    if (tallWindow(b) !== this.tall) {
      this.tall = !this.tall; // landed: back to compact
      this.apply();
    }
    if (b.phase !== "spinning") {
      this.leaned = null;
      this.leaning = false;
      if (this.spun) {
        // the sim leaves `spinning` in the tick that ends the spin, so no frame ever shows fraction 1: land them now
        this.spun = false;
        for (let i = 0; i < this.n; i++) this.root.land(i);
      }
      return { lean: null, landed: [] };
    }
    this.spun = true;
    b.reels.forEach((r, i) =>
      this.root.update(i, { elapsed: Math.min(b.elapsed, r.duration), fullDuration: r.duration, crawl: crawlSeconds(r.tease, r.duration) }),
    );
    const landed = earlyLandings(b.reels, this.lastElapsed ?? b.elapsed, b.elapsed);
    this.lastElapsed = b.elapsed;
    const lean = this.leanIn(b.reels, b.elapsed);
    this.leaning = leanHeld(b.reels, this.leaned, b.elapsed) !== null;
    return { lean, landed };
  }

  /** The centre of the reel the camera leans toward, or null when it has not leaned or that reel has landed. */
  leanCentre(): Pt | null {
    const r = this.leaning && this.leaned !== null ? this.root.rect(this.leaned) : null;
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }

  /** The lean, the first frame the strongest tease is into its crawl (once a spin), else null. */
  private leanIn(reels: readonly BenchReel[], elapsed: number): ReelLean | null {
    const i = leanReel(reels);
    const r = i === null ? null : reels[i]!;
    if (i === null || !r?.tease || this.leaned !== null || elapsed < r.duration - crawlSeconds(r.tease, r.duration)) return null;
    this.leaned = i; // a red or a knife is crawling in (or a fake one): lean in toward its reel
    return { strength: r.tease.strength, seconds: r.duration - elapsed };
  }

  private apply(): void {
    if (this.l) this.root.layout(stackRects(benchReelArea(this.l, this.n, this.tall), this.n, REEL_MAX_H));
  }
}
