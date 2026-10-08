import { afterEach, describe, expect, it } from "vitest";
import { getLang, setLang } from "../i18n/index";
import { DEFAULT_PREFS, getPrefs, initPrefs, parsePrefs, PREFS_KEY, setPrefs } from "./prefs";

afterEach(() => setLang("en"));

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const broken = {
  getItem: (): string | null => {
    throw new Error("SecurityError");
  },
  setItem: (): void => {
    throw new Error("QuotaExceededError");
  },
};

describe("prefs", () => {
  it("cleans up whatever was stored", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{not json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"lang":"de","music":7,"sfx":"loud"}')).toEqual({ lang: null, music: 1, sfx: DEFAULT_PREFS.sfx });
    expect(parsePrefs('{"lang":"ru","music":0.2,"sfx":0}')).toEqual({ lang: "ru", music: 0.2, sfx: 0 });
  });

  it("follows the browser language until the player picks one", () => {
    initPrefs(memory(), ["ru-RU"]);
    expect(getLang()).toBe("ru");
    const s = memory();
    s.setItem(PREFS_KEY, '{"lang":"en"}');
    initPrefs(s, ["ru-RU"]);
    expect(getLang()).toBe("en");
  });

  it("remembers changes", () => {
    const s = memory();
    initPrefs(s, ["en"]);
    setPrefs({ lang: "ru", music: 0.3 });
    expect(getLang()).toBe("ru");
    expect(parsePrefs(s.getItem(PREFS_KEY))).toEqual({ lang: "ru", music: 0.3, sfx: DEFAULT_PREFS.sfx });
  });

  it("keeps working when storage is blocked", () => {
    expect(() => initPrefs(broken, ["en"])).not.toThrow();
    expect(() => setPrefs({ sfx: 0.1 })).not.toThrow();
    expect(getPrefs().sfx).toBe(0.1);
    expect(() => initPrefs(null, [])).not.toThrow();
  });
});
