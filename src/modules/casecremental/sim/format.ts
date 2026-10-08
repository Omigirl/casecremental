// Money text for the HUD: two decimals under $10, whole dollars under $1000, then suffixes,
// then scientific notation. Never prints NaN or Infinity, never "$1000K" at a suffix boundary,
// never "-$0.00".

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** 2 / 1 / 0 decimals so the number keeps three significant digits. */
const threeDigits = (x: number): string => x.toFixed(x < 10 ? 2 : x < 100 ? 1 : 0);

export function formatCash(n: number, lang: "en" | "ru" = "en"): string {
  const text = formatCashEn(n);
  return lang === "ru" ? text.replace(/(\d)\.(\d)/, "$1,$2") : text;
}

function formatCashEn(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "$∞" : n < 0 ? "-$∞" : "$0.00";
  const a = Math.abs(n);
  const sign = n < 0 && a >= 0.005 ? "-" : "";
  if (a < 10) return `${sign}$${a.toFixed(2)}`;
  if (Math.round(a) < 1000) return `${sign}$${Math.round(a)}`;

  let group = Math.max(1, Math.floor(Math.log10(a) / 3));
  let text = threeDigits(a / 1000 ** group);
  if (Number(text) >= 1000) {
    // 999.5K rounds to "1000" — that's 1.00M
    group += 1;
    text = threeDigits(a / 1000 ** group);
  }
  if (group >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(a));
    return `${sign}$${(a / 10 ** exp).toFixed(2)}e${exp}`;
  }
  return `${sign}$${text}${SUFFIXES[group]}`;
}
