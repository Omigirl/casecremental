import { VAULT_CUES } from "./cues";

/** The total shown under the columns: 0 before the celebration (9.0), counting up to `total` by 11.5
 *  (ease-out), `total` after. */
export function countUp(t: number, total: number): number {
  const { celebrateFrom: a, celebrateTo: b } = VAULT_CUES;
  if (t <= a) return 0;
  if (t >= b) return total;
  const u = (t - a) / (b - a);
  return total * (1 - (1 - u) ** 3);
}
