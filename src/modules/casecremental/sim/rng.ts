// Seeded RNG (mulberry32): the whole run is reproducible from one seed, which the tests and the
// pacing bot rely on.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick from an empty list");
      return items[Math.floor(next() * items.length)] as T;
    },
  };
}
