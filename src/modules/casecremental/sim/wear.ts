import { WEAR_TABLE } from "./tuning";
import type { WearId } from "./types";

export function wearOf(float: number): { id: WearId; name: string; mult: number } {
  const row = WEAR_TABLE.find((w) => float < w.maxFloat) ?? WEAR_TABLE[WEAR_TABLE.length - 1]!;
  return { id: row.id, name: row.name, mult: row.mult };
}
