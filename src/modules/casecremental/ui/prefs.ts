import { detectLang, setLang, type Lang } from "../i18n/index";

// Per-player conveniences remembered in this browser (spec §8): language and the two volumes.
// Storage may be missing, full or blocked (private windows, embeds) — then the defaults apply and
// the game carries on.

export interface Prefs {
  /** null = follow the browser language. */
  lang: Lang | null;
  music: number;
  sfx: number;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export const PREFS_KEY = "casecremental:prefs";
export const DEFAULT_PREFS: Prefs = { lang: null, music: 0.6, sfx: 0.8 };

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Whatever was stored → valid prefs (unknown fields dropped, bad values replaced by defaults). */
export function parsePrefs(raw: string | null): Prefs {
  let o: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") o = parsed as Record<string, unknown>;
  } catch {
    // corrupt value: start from the defaults
  }
  return {
    lang: o.lang === "en" || o.lang === "ru" ? o.lang : null,
    music: clamp01(o.music, DEFAULT_PREFS.music),
    sfx: clamp01(o.sfx, DEFAULT_PREFS.sfx),
  };
}

function browserStore(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

let current: Prefs = DEFAULT_PREFS;
let store: Store | null = null;
const listeners = new Set<() => void>();

/** Read the stored prefs and apply the language. Call once in the module's setup. */
export function initPrefs(s: Store | null = browserStore(), languages: readonly string[] = typeof navigator !== "undefined" ? navigator.languages : []): Prefs {
  store = s;
  let raw: string | null = null;
  try {
    raw = s?.getItem(PREFS_KEY) ?? null;
  } catch {
    raw = null;
  }
  current = parsePrefs(raw);
  setLang(current.lang ?? detectLang(languages));
  return current;
}

export const getPrefs = (): Prefs => current;

export function setPrefs(patch: Partial<Prefs>): void {
  current = parsePrefs(JSON.stringify({ ...current, ...patch }));
  if (current.lang) setLang(current.lang);
  try {
    store?.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    // not remembered this time; the change still applies
  }
  for (const fn of listeners) fn();
}

export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
