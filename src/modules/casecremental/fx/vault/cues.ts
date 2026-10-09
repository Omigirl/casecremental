// The vault opening as a jackpot (spec 2026-10-09 §1): seconds after the key turns. A held beat before the
// impact, the lid slamming open, the rainbow fan, the columns cascading in, the spin, the five lock-ins (sim
// events at VAULT_LAND_TIMES), the golden pulse and the count-up, then the results hold. Pure functions of time.

export const VAULT_CUES = {
  riserEnd: 0.9,
  impact: 1.0,
  raysFrom: 1.5,
  raysFull: 2.5,
  columnsFrom: 1.5,
  columnStagger: 0.1,
  spinFrom: 2.5,
  fireworks: [1.0, 3.0, 5.0],
  celebrateFrom: 9.0,
  celebrateTo: 11.5,
} as const;

/** Where the lock-ins start (the first landing). */
const LOCKINS_FROM = 6.0;
const COLUMN_IN_SECONDS = 0.25;
const LID_SECONDS = 0.5;
const PULSE_SECONDS = 0.6;
/** The fan's resting strength once the celebration has softened it to a glow. */
const GLOW = 0.3;

export interface VaultCues {
  phase: "anticipation" | "impact" | "rays" | "spin" | "lockins" | "celebrate" | "hold";
  /** 0-1 tremble energy (anticipation), 0 after the impact. */
  tremble: number;
  /** 0-1 seam light width. */
  seam: number;
  /** The lid: 0 closed -> 1 open, with an overshoot just after the impact (may exceed 1 briefly). */
  lid: number;
  /** 0-1 rainbow fan strength (rises 1.5-2.5, softens to a glow 9.0-11.5). */
  rays: number;
  /** How far each of the five columns has come in, 0-1 (cascade 100 ms apart from 1.5). */
  columnIn: [number, number, number, number, number];
  /** 0-1 particle density (high while spinning, thinning in the celebration). */
  density: number;
  /** 0-1 the golden pulse across the frames at 9.0. */
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

  // Grows 0.1 -> 0.85 up to the riser's end, then the held beat: dead still until the impact.
  const tremble = t < 0 || t >= C.riserEnd ? 0 : 0.1 + 0.75 * (t / C.riserEnd);
  const seam = t < C.impact ? 0.3 * clamp01(t / C.riserEnd) : 1;

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

  return { phase, tremble, seam, lid, rays, columnIn, density, pulse };
}
