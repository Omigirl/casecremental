// Money text for the HUD: two decimals under $10, whole dollars under $1000, then suffixes,
// then scientific notation. Never prints NaN or Infinity.

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function formatCash(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "$∞" : n < 0 ? "-$∞" : "$0.00";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a < 10) return `${sign}$${a.toFixed(2)}`;
  if (a < 1000) return `${sign}$${Math.round(a)}`;
  const group = Math.floor(Math.log10(a) / 3);
  if (group >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(a));
    return `${sign}$${(a / 10 ** exp).toFixed(2)}e${exp}`;
  }
  const scaled = a / 1000 ** group;
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return `${sign}$${scaled.toFixed(digits)}${SUFFIXES[group]}`;
}
