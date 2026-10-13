import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_PREFS_KEY } from "../login/i18n";
import { lobbyT, t } from "./i18n";

// The lobby speaks the game's language (the pick stored with the game's prefs, as the sign-in screen
// reads it), not just the browser's: "Play" next to the game's English tabs, "Играть" next to Russian.

const withStoredPrefs = (prefs: string | null) => {
  const data = new Map(prefs === null ? [] : [[GAME_PREFS_KEY, prefs]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    },
  });
};

afterEach(() => vi.unstubAllGlobals());

describe("lobby language", () => {
  it("has both tables", () => {
    expect(lobbyT("en")("play")).toBe("Play");
    expect(lobbyT("ru")("play")).toBe("Играть");
    expect(lobbyT("ru")("back")).toBe("Назад");
  });

  it("follows the game's stored pick over the browser language", () => {
    vi.stubGlobal("navigator", { languages: ["ru-RU"], language: "ru-RU" });
    withStoredPrefs('{"lang":"en","music":0.2}');
    expect(t("play")).toBe("Play");
    withStoredPrefs('{"lang":"ru"}');
    expect(t("play")).toBe("Играть");
  });

  it("falls back to the browser language when the game has no pick", () => {
    vi.stubGlobal("navigator", { languages: ["ru-RU"], language: "ru-RU" });
    withStoredPrefs('{"lang":null}');
    expect(t("play")).toBe("Играть");
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    withStoredPrefs(null);
    expect(t("play")).toBe("Play");
  });
});
