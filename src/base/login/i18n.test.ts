import { describe, expect, it } from "vitest";
import {
  authErrorText,
  detectLoginLang,
  GAME_PREFS_KEY,
  loginMsgText,
  loginT,
  saveLoginLang,
} from "./i18n";

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe("sign-in language", () => {
  it("follows the game's stored pick first, then the first browser language", () => {
    expect(
      detectLoginLang(memoryStore({ [GAME_PREFS_KEY]: '{"lang":"ru"}' }), [
        "en-US",
      ]),
    ).toBe("ru");
    expect(
      detectLoginLang(memoryStore({ [GAME_PREFS_KEY]: '{"lang":"en"}' }), [
        "ru-RU",
      ]),
    ).toBe("en");
    expect(
      detectLoginLang(memoryStore({ [GAME_PREFS_KEY]: '{"lang":null}' }), [
        "ru-RU",
        "en",
      ]),
    ).toBe("ru");
    expect(detectLoginLang(memoryStore(), ["de-DE", "ru"])).toBe("en");
    expect(detectLoginLang(null, [])).toBe("en");
  });

  it("survives a corrupt or foreign stored value", () => {
    expect(
      detectLoginLang(memoryStore({ [GAME_PREFS_KEY]: "{oops" }), ["ru"]),
    ).toBe("ru");
    expect(
      detectLoginLang(memoryStore({ [GAME_PREFS_KEY]: '["ru"]' }), ["en"]),
    ).toBe("en");
    expect(
      detectLoginLang(memoryStore({ [GAME_PREFS_KEY]: '{"lang":"de"}' }), [
        "en",
      ]),
    ).toBe("en");
  });

  it("saves only the lang field and keeps the game's other prefs", () => {
    const store = memoryStore({
      [GAME_PREFS_KEY]: '{"lang":null,"music":0.2,"sfx":1}',
    });
    saveLoginLang("ru", store);
    expect(JSON.parse(store.data.get(GAME_PREFS_KEY) ?? "")).toEqual({
      lang: "ru",
      music: 0.2,
      sfx: 1,
    });
    const empty = memoryStore();
    saveLoginLang("en", empty);
    expect(JSON.parse(empty.data.get(GAME_PREFS_KEY) ?? "")).toEqual({
      lang: "en",
    });
  });

  it("does not throw when storage refuses the write", () => {
    const store = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveLoginLang("ru", store)).not.toThrow();
  });
});

describe("sign-in strings", () => {
  it("fills placeholders and translates", () => {
    expect(loginT("en")("resendIn", { n: 42 })).toBe("Send again in 42s");
    expect(loginT("ru")("resendIn", { n: 42 })).toBe("Ещё раз через 42 с");
  });

  it("turns known refusal codes into sentences and passes unknown ones through", () => {
    const ru = loginT("ru");
    expect(authErrorText(ru, "INCORRECT_EMAIL_OR_PASSWORD")).toBe(
      "Неверная почта или пароль.",
    );
    expect(authErrorText(ru, "SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(authErrorText(ru, "Internet Connection Error")).toBe(
      "Нет связи с сервером игры. Проверьте интернет и попробуйте ещё раз.",
    );
    expect(authErrorText(loginT("en"), undefined)).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("keeps every button label within a 390-px phone at 16 px (Press Start 2P: 16 px per glyph)", () => {
    // 390 - 2×16 gutter - 2×4 panel border - 2×12 panel padding - 2×40 icon padding = 246 px → 15 glyphs.
    const labels = [
      "signIn",
      "wallet",
      "idos",
      "google",
      "apple",
      "telegram",
      "email",
      "guest",
      "signingIn",
      "doSignIn",
      "createAccount",
      "confirm",
      "sendCode",
      "setPassword",
    ] as const;
    for (const lang of ["en", "ru"] as const) {
      const t = loginT(lang);
      for (const k of labels)
        expect(t(k).length, `${lang}:${k}`).toBeLessThanOrEqual(15);
    }
  });
});

describe("stored messages", () => {
  it("re-translate when the language changes", () => {
    const code = { code: "INVALID_VERIFICATION_CODE" };
    expect(loginMsgText(loginT("en"), code)).toBe(
      authErrorText(loginT("en"), "INVALID_VERIFICATION_CODE"),
    );
    expect(loginMsgText(loginT("ru"), code)).toBe(
      authErrorText(loginT("ru"), "INVALID_VERIFICATION_CODE"),
    );
    expect(loginMsgText(loginT("ru"), code)).not.toBe(
      loginMsgText(loginT("en"), code),
    );
    const own = { key: "passwordChanged" } as const;
    expect(loginMsgText(loginT("ru"), own)).toBe(loginT("ru")("passwordChanged"));
    expect(loginMsgText(loginT("ru"), own)).not.toBe(loginMsgText(loginT("en"), own));
  });

  it("keeps an unknown server code as is and maps a missing one to the generic text", () => {
    expect(loginMsgText(loginT("ru"), { code: "WEIRD_CODE" })).toBe("WEIRD_CODE");
    expect(loginMsgText(loginT("en"), { code: undefined })).toBe(
      loginT("en")("err.unknown"),
    );
  });
});
