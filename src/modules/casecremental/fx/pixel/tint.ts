/** Scales each RGB channel of a 0xRRGGBB tint by `level` (0 = black, 1 = unchanged). */
export function scaleTint(tint: number, level: number): number {
  const k = Math.min(1, Math.max(0, level));
  const ch = (shift: number) => Math.round(((tint >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
