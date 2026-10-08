import { EN, type StringKey } from "./en";
import { RU } from "./ru";

// Current language + translation. The UI subscribes with onLangChange (React: useSyncExternalStore);
// content names (content.ts) read getLang() at call time, so a switch takes effect on the next render.

export type Lang = "en" | "ru";
export type { StringKey } from "./en";

let current: Lang = "en";
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  for (const fn of listeners) fn();
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The first browser language decides: Russian → "ru", anything else → "en". */
export function detectLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const table = current === "ru" ? RU : EN;
  const raw: string = table[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : raw;
}
