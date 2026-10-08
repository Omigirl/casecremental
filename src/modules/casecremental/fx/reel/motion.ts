import type { Tease } from "../../sim/tease";

// How far along its path the reel is (0 → 1), never backwards. A plain spin is an ease-out over
// the full duration. A teasing spin covers all but the last CRAWL_SHARE of the path fast, its
// speed easing down to a crawl, then crawls the rest, slowing evenly to a stop exactly at the end
// — position and speed both continuous at the hand-over.

export interface ReelMotion {
  elapsed: number;
  fullDuration: number;
  /** Seconds of crawl at the end (0: a plain spin). */
  crawl: number;
}

/** The share of the path (≈ the last two cards) left for the crawl. */
export const CRAWL_SHARE = 0.05;
/** A tease also crawls through this share of the normal spin, not just its extra time. */
const CRAWL_OF_SPIN = 0.25;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function easeOutQuart(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u * u;
}

export function crawlSeconds(tease: Tease | null, fullDuration: number): number {
  if (!tease) return 0;
  return tease.extraSeconds + CRAWL_OF_SPIN * (fullDuration - tease.extraSeconds);
}

export function reelFraction(m: ReelMotion): number {
  if (m.crawl <= 0) return easeOutQuart(m.elapsed / m.fullDuration);
  if (m.elapsed >= m.fullDuration) return 1;
  const C = Math.min(m.crawl, m.fullDuration);
  const A = m.fullDuration - C;
  const F = 1 - CRAWL_SHARE;
  const vc = (2 * CRAWL_SHARE) / C; // crawl: from vc down to 0 over C covers the last share
  if (A <= 0) return 1 - (1 - m.elapsed / C) ** 2;
  if (m.elapsed >= A) {
    const u = m.elapsed - A;
    return F + vc * u - (vc * u * u) / (2 * C);
  }
  const t = m.elapsed;
  if (F <= vc * A) return (F * t) / A; // a crawl too long to blend into: plain glide, still continuous
  // fast: speed vc + (v0 − vc)(1 − t/A)², which covers exactly F by t = A
  const v0 = vc + (3 * (F - vc * A)) / A;
  return vc * t + ((v0 - vc) * A * (1 - (1 - t / A) ** 3)) / 3;
}
