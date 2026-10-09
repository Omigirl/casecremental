import { VAULT_INTRO_SECONDS, VAULT_LAND_TIMES } from "../../sim/tuning";

// The vault opening as a jackpot (spec 2026-10-09 §1, plan M2b-C8): seconds after the key turns. The intro plays
// and its kicks jolt the chest (three build hits, a held pause, a five-hit run-up); on its end the impact — the lid
// slamming open on the fanfare's drop; the rainbow fan, the columns cascading in, the spin, the five lock-ins (sim
// events at VAULT_LAND_TIMES), the golden pulse and the count-up, then the results hold. Every time after the
// impact counts from it (VAULT_INTRO_SECONDS, the sim's). Pure functions of time.

const IMPACT = VAULT_INTRO_SECONDS;
/** `s` seconds after the impact, as the 2-decimal time it lands on (so 3.4 + 5 is exactly 8.4, a lock-in). */
const after = (s: number) => Math.round((IMPACT + s) * 100) / 100;

export const VAULT_CUES = {
  impact: IMPACT,
  raysFrom: after(0.5),
  raysFull: after(1.5),
  columnsFrom: after(0.5),
  columnStagger: 0.1,
  spinFrom: after(1.5),
  /** The kick explosions: the impact, every second of the spin, every lock-in (sim/tuning VAULT_LAND_TIMES), and
   *  a volley as the count-up starts. The intro's hits are not among them (their kick is in the intro itself). */
  fireworks: [IMPACT, after(1.5), after(2.5), after(3.5), after(4.5), ...VAULT_LAND_TIMES, after(8), after(8.35), after(8.7), after(9.05)],
  celebrateFrom: after(8),
  celebrateTo: after(10.5),
} as const;

export type IntroHitKind = "build" | "run";
export interface IntroHit {
  readonly at: number;
  readonly kind: IntroHitKind;
}

/** The intro's kicks (measured from its < 140 Hz energy): three build hits, a held pause, then the run-up into the
 *  impact. The visuals follow them; their sound is the intro's own. */
export const INTRO_HITS: readonly IntroHit[] = [
  { at: 0.45, kind: "build" },
  { at: 0.8, kind: "build" },
  { at: 1.15, kind: "build" },
  { at: 2.0, kind: "run" },
  { at: 2.3, kind: "run" },
  { at: 2.65, kind: "run" },
  { at: 2.95, kind: "run" },
  { at: 3.3, kind: "run" },
];
/** The held pause between the build and the run-up: the chest holds still, its seam glowing steadily. */
export const INTRO_PAUSE = { from: 1.4, to: 1.95 } as const;

/** Where the lock-ins start (the first landing). */
const LOCKINS_FROM = VAULT_LAND_TIMES[0];
const COLUMN_IN_SECONDS = 0.25;
const LID_SECONDS = 0.5;
const PULSE_SECONDS = 0.6;
/** The fan's resting strength once the celebration has softened it to a glow. */
const GLOW = 0.3;
/** An intro hit dies away over this long (under the run-up's 0.30 s gaps). */
const HIT_SECONDS = 0.25;
/** The tremble on hit i: harder with each one, the last at full. */
const HIT_STRENGTH = (i: number) => 0.3 + (0.7 * i) / (INTRO_HITS.length - 1);
/** The seam: lit to here before the first hit (the closed frame), widening this much per hit, flashing this much on one. */
const SEAM_START = 0.15;
const SEAM_BASE = 0.25;
const SEAM_STEP = 0.075;
const SEAM_FLASH = 0.25;

/** The last intro hit at or before t (its index) and its pulse: 1 on the hit, dying away over HIT_SECONDS; none
 *  from the impact on. */
export function introHit(t: number): { index: number; pulse: number } {
  if (t >= IMPACT) return { index: INTRO_HITS.length - 1, pulse: 0 };
  let index = -1;
  for (let i = 0; i < INTRO_HITS.length && INTRO_HITS[i]!.at <= t; i++) index = i;
  if (index < 0) return { index, pulse: 0 };
  const u = (t - INTRO_HITS[index]!.at) / HIT_SECONDS;
  return { index, pulse: u < 1 ? (1 - u) ** 2 : 0 };
}

export interface VaultCues {
  phase: "anticipation" | "impact" | "rays" | "spin" | "lockins" | "celebrate" | "hold";
  /** 0-1 the chest's jolt on an intro hit (harder with each), dying away; 0 in the pause and after the impact. */
  tremble: number;
  /** 0-1 an intro hit's pulse (1 on the hit, gone before the next); 0 after the impact. */
  hit: number;
  /** 0-1 seam light width. */
  seam: number;
  /** The lid: 0 closed -> 1 open, with an overshoot just after the impact (may exceed 1 briefly). */
  lid: number;
  /** 0-1 rainbow fan strength (rises over the second after raysFrom, softens to a glow through the celebration). */
  rays: number;
  /** How far each of the five columns has come in, 0-1 (cascade 100 ms apart from columnsFrom). */
  columnIn: [number, number, number, number, number];
  /** 0-1 particle density (high while spinning, thinning in the celebration). */
  density: number;
  /** 0-1 the golden pulse across the frames as the celebration starts. */
  pulse: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

export function vaultCues(t: number): VaultCues {
  const C = VAULT_CUES;
  const phase: VaultCues["phase"] =
    t < C.impact
      ? "anticipation"
      : t < C.raysFrom
        ? "impact"
        : t < C.spinFrom
          ? "rays"
          : t < LOCKINS_FROM
            ? "spin"
            : t < C.celebrateFrom
              ? "lockins"
              : t < C.celebrateTo
                ? "celebrate"
                : "hold";

  // the intro's hits jolt the chest and flash its seam, which widens hit by hit (held steady through the pause)
  const { index, pulse: hit } = introHit(t);
  const tremble = index < 0 ? 0 : hit * HIT_STRENGTH(index);
  const seam =
    t >= C.impact
      ? 1
      : index < 0
        ? SEAM_START * clamp01(t / INTRO_HITS[0]!.at)
        : Math.min(1, SEAM_BASE + SEAM_STEP * index + SEAM_FLASH * hit);

  let lid = 0;
  if (t >= C.impact) {
    const u = (t - C.impact) / LID_SECONDS;
    lid = u >= 1 ? 1 : 1 + 0.12 * Math.sin(Math.PI * u) * (1 - u);
  }

  const rays =
    t < C.celebrateFrom
      ? easeOut((t - C.raysFrom) / (C.raysFull - C.raysFrom))
      : 1 - (1 - GLOW) * easeOut((t - C.celebrateFrom) / (C.celebrateTo - C.celebrateFrom));

  const columnIn = [0, 1, 2, 3, 4].map((i) =>
    easeOut((t - (C.columnsFrom + C.columnStagger * i)) / COLUMN_IN_SECONDS),
  ) as VaultCues["columnIn"];

  const density =
    t < C.impact
      ? 0
      : t < C.celebrateFrom
        ? easeOut((t - C.impact) / (C.raysFull - C.impact))
        : 1 - 0.7 * easeOut((t - C.celebrateFrom) / (C.celebrateTo - C.celebrateFrom));

  const pu = (t - C.celebrateFrom) / PULSE_SECONDS;
  const pulse = pu > 0 && pu < 1 ? Math.sin(Math.PI * pu) : 0;

  return { phase, tremble, hit, seam, lid, rays, columnIn, density, pulse };
}
