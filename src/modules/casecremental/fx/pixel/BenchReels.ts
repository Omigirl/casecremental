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
// more than one spins the window is tall — the cards are not up yet — and it snaps back to compact as they land:
// Reel.layout rebuilds the whole strip, so it is not glided frame by frame.

/** The tallest one reel gets in a stack. */
const REEL_MAX_H = 26;

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

export class BenchReels {
  readonly root: StackedReels;
  private l: TableLayout | null = null;
  private n = 1;
  private tall = false;
  /** The reel the camera has leaned toward this spin, or null. */
  private leaned: number | null = null;

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
    this.leaned = null;
    this.apply();
    const c = caseById(caseId);
    reels.forEach((r, i) => this.root.start(i, c, skinById(r.drop.skinId), rng, r.tease));
  }

  /** Move every reel; a lean the first frame the strongest tease is into its crawl, else null. */
  update(b: BenchState): ReelLean | null {
    if (b.phase !== "spinning") {
      this.leaned = null;
      if (this.tall) {
        this.tall = false; // landed: back to compact
        this.apply();
      }
      return null;
    }
    b.reels.forEach((r, i) =>
      this.root.update(i, { elapsed: Math.min(b.elapsed, r.duration), fullDuration: r.duration, crawl: crawlSeconds(r.tease, r.duration) }),
    );
    const i = leanReel(b.reels);
    const r = i === null ? null : b.reels[i]!;
    if (i === null || !r?.tease || this.leaned !== null || b.elapsed < r.duration - crawlSeconds(r.tease, r.duration)) return null;
    this.leaned = i; // a red or a knife is crawling in (or a fake one): lean in toward its reel
    return { strength: r.tease.strength, seconds: r.duration - b.elapsed };
  }

  /** The centre of the reel the camera leans toward this spin, or null when it has not leaned (or has landed). */
  leanCentre(): Pt | null {
    const r = this.leaned === null ? null : this.root.rect(this.leaned);
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }

  private apply(): void {
    if (this.l) this.root.layout(stackRects(benchReelArea(this.l, this.n, this.tall), this.n, REEL_MAX_H));
  }
}
