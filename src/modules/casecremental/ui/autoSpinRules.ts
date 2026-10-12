import type { StringKey } from "../i18n/en";
import type { Lang } from "../i18n/index";
import type { AutoSpinStatus } from "../sim/autoSpin";

// Auto-spin's rows (finish spec §3): what the status line says, and how a delay prints.

/** What auto-spin's rows say it is doing. */
export function statusKey(s: AutoSpinStatus): StringKey {
  return s === "on" ? "autospin.running" : s === "broke" ? "autospin.broke" : s === "vault" ? "autospin.vault" : "autospin.idle";
}

/** A delay as the rows print it: "1.5", "0.55", with a decimal comma in Russian. */
export function delaySeconds(s: number, lang: Lang): string {
  const text = String(Math.round(s * 100) / 100);
  return lang === "ru" ? text.replace(".", ",") : text;
}
