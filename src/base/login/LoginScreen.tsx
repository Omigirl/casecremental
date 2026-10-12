import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AuthType,
  beginSsoRedirect,
  type AuthOptionsResponse,
} from "@idosgames/core";
import type { LoginScreenProps } from "@idosgames/app-shell";
import "@fontsource/press-start-2p/latin-400.css";
import "@fontsource/press-start-2p/cyrillic-400.css";
import { ENV_GOOGLE_CLIENT_ID } from "../../env";
import { loginIcons } from "./loginIcons";
import { LoginBackdrop } from "./LoginBackdrop";
import { LOGIN_CSS } from "./loginCss";
import {
  authErrorText,
  detectLoginLang,
  loginT,
  saveLoginLang,
  type LoginLang,
} from "./i18n";
import {
  glyphDataUrl,
  ICONS,
  PixelGlyph,
  Sprite,
  type Crop,
  type Strip,
} from "./pixelArt";
import vaultUrl from "./assets/vault-case.png";
import keyUrl from "./assets/key.png";

// The Login scene. The host runtime owns WHEN this is shown (the auth gate in
// @idosgames/app-shell); this file owns what it LOOKS like and which providers it offers.
//
// Casecremental's own look (not the UI kit's theme): the game's workshop wall with a case reel and
// the workbench behind (./LoginBackdrop), the vault chest and the key over a pixel logo, and the
// providers on a pixel-framed panel with the game's bevelled buttons (./loginCss). English and
// Russian (./i18n): the player's pick in the game, else the browser language; EN/RU under the panel.
//
// Providers on `client.auth`: loginWithDeviceID (guest), loginWithEmail + registerWithEmail,
// loginWithGoogle, loginWithApple, loginWithTelegram, loginWithWallet, loginWithSsoCode, plus
// forgotPassword/resetPassword.
//
// A provider is only rendered when it can actually complete, so players never meet a dead button:
//   guest / email - always available, no external setup (guest only on an open title).
//   Google        - the title's own Google sign-in (platform setting) or VITE_IDOS_GOOGLE_CLIENT_ID;
//                   the Google Identity script is loaded on demand.
//   Apple         - when the title set up Sign in with Apple for the web (a Services ID).
//   Telegram      - only inside a Telegram Mini App (it signs in with the app's initData).
//   wallet        - always offered; ./walletLogin owns the wagmi config and the challenge network.
//   iDos Games    - only where the platform accepts a return_to (see isSsoAvailable below).
//
// The title's login mode decides the rest (platform setting: Blockchain -> login mode):
//   Open                - every method;
//   AnyWithLinkedWallet - every method except guest (a guest cannot link a wallet);
//   WalletOnly          - the wallet and iDos Games only: an iDos Games account plays with a wallet
//                         linked to it (one wallet - one account), everything else is refused.

// Куда платформа соглашается вернуть одноразовый код. Список повторяет allowlist на бэкенде
// (SsoService.AllowedOrigins) НАМЕРЕННО: здесь он решает только, показывать ли кнопку, а
// настоящий барьер стоит на сервере. Показать кнопку там, где сервер откажет, — значит
// пообещать игроку вход, который не состоится.
const SSO_ORIGINS = [
  "https://cloud.idosgames.com",
  "https://idosgames.com",
  "https://www.idosgames.com",
];

// Свои адреса игры: {titleid}.idos.games и {titleid}-dev.idos.games (её DEV-копия). Сервер примет
// каждый ТОЛЬКО для этого же тайтла.
const GAME_HOST = /^https:\/\/[a-z0-9]{8}(-dev)?\.idos\.games$/;

function isSsoAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const { origin } = window.location;
  if (SSO_ORIGINS.includes(origin) || GAME_HOST.test(origin)) return true;

  // Свой домен издателя (play.brand.com) id тайтла не несёт, и по origin не понять, сработает ли
  // вход. Страницу, которую отдаёт платформа, её сервер помечает этой меткой — а на свой домен он
  // отдаёт игру, только когда домен подключён к ЭТОМУ тайтлу. В превью и на чужом хостинге метки нет.
  return (
    typeof document !== "undefined" &&
    document.querySelector('meta[name="idos-game-host"]') !== null
  );
}

export interface LoginScreenExtras {
  /**
   * Wallet sign-in. Supplied by ./walletLogin (wired in main.tsx), which renders the ready-made
   * `WalletLogin` from `@idosgames/wallet/react`: connect → sign the challenge → session, then
   * `onAuthenticated()`. The screen passes its own `style` so the button matches the theme.
   *
   * A remembered wallet session comes back on the next launch by its refresh token (no new
   * signature); the server re-checks the token balance on it when the title's login mode needs one.
   */
  renderWalletLogin?: (props: {
    client: LoginScreenProps["client"];
    onAuthenticated: () => void;
    disabled: boolean;
    style?: CSSProperties;
    /** The button's text, in the screen's language. */
    label?: string;
  }) => ReactNode;
}

/** Пауза повторной отправки, когда сервер её не назвал. Совпадает со значением платформы. */
const DEFAULT_RESEND_COOLDOWN = 60;

// Служебный код отказа → фраза для игрока: ./i18n authErrorText (на двух языках). Без этого экран
// показывал бы коды КАК ЕСТЬ («EMAIL_SENDER_NOT_CONFIGURED»); незнакомый код возвращается как есть.

const INK = "#120e10";
const CREAM = "#fff6d5";
const DIM = "#a89a8c";
const VAULT: Strip = { url: vaultUrl, frameW: 68, frameH: 78, frames: 4 };
const KEY: Strip = { url: keyUrl, frameW: 16, frameH: 24, frames: 4 };
/** The closed chest and the key without the headroom of their animations (frame 0's art bounds). */
const VAULT_ART: Crop = { x: 13, y: 48, w: 44, h: 30 };
const KEY_ART: Crop = { x: 0, y: 12, w: 12, h: 12 };

type Mode = "menu" | "email" | "verify" | "forgot" | "reset";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const APPLE_SCRIPT =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

/** Loads a provider's script once; resolves when it has run. */
function loadScript(src: string): Promise<void> {
  if (typeof document === "undefined")
    return Promise.reject(new Error("no document"));
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${src}"]`,
  );
  if (existing?.dataset.loaded === "1") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = existing ?? document.createElement("script");
    el.addEventListener("load", () => {
      el.dataset.loaded = "1";
      resolve();
    });
    el.addEventListener("error", () =>
      reject(new Error(`could not load ${src}`)),
    );
    if (!existing) {
      el.src = src;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

/** A random nonce for the provider's request: the server checks the token carries it, then burns it. */
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Inside a Telegram Mini App the app hands over signed initData - the one thing Telegram login needs. */
function hasTelegramInitData(): boolean {
  const tg = (globalThis as { Telegram?: { WebApp?: { initData?: string } } })
    .Telegram;
  return Boolean(tg?.WebApp?.initData);
}

/** Minimal Sign in with Apple JS surface - declared here so the template needs no Apple typings. */
type AppleIdentity = {
  auth: {
    init(config: {
      clientId: string;
      scope: string;
      redirectURI: string;
      usePopup: boolean;
      nonce?: string;
    }): void;
    signIn(): Promise<{
      authorization: { id_token: string };
      user?: { name?: { firstName?: string; lastName?: string } };
    }>;
  };
};

/** Minimal Google Identity surface — declared here so the template needs no @types/google.accounts. */
type GoogleIdentity = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }): void;
      prompt(): void;
    };
  };
};

export function LoginScreen({
  client,
  onAuthenticated,
  renderWalletLogin,
}: LoginScreenProps & LoginScreenExtras): ReactNode {
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(DEFAULT_RESEND_COOLDOWN);

  const [remember, setRemember] = useState(true);

  const [lang, setLang] = useState<LoginLang>(() => detectLoginLang());
  const t = useMemo(() => loginT(lang), [lang]);
  const pickLang = (next: LoginLang): void => {
    setLang(next);
    saveLoginLang(next);
  };

  // The providers' own marks (Google, Telegram, Apple, iDos) and the game's pixel glyphs for the rest,
  // painted in the button's text colour (an image cannot read CSS).
  const icons = useMemo(() => {
    const brand = loginIcons({ ink: CREAM, dim: DIM, onPrimary: INK });
    return {
      ...brand,
      wallet: glyphDataUrl(ICONS.wallet, INK),
      email: glyphDataUrl(ICONS.email, CREAM),
      guest: glyphDataUrl(ICONS.guest, CREAM),
    };
  }, []);

  const [notice, setNotice] = useState<string | null>(null);

  // The title's sign-in settings, read before login: the login mode (so the screen never offers a
  // method the server refuses anyway) and which providers the title set up (Google, Apple). Until
  // they arrive the open-title set is shown - the server check is the real barrier, this only
  // keeps dead buttons off the screen.
  const [options, setOptions] = useState<AuthOptionsResponse | null>(null);
  useEffect(() => {
    let active = true;
    void client.auth.getAuthOptions().then((result) => {
      if (active && result.ok) setOptions(result.data);
    });
    return () => {
      active = false;
    };
  }, [client]);
  const loginMode = options?.PlayAccessMode ?? "Open";
  const walletOnly = loginMode === "WalletOnly";
  const guestAllowed = loginMode === "Open";
  const googleClientID =
    ENV_GOOGLE_CLIENT_ID ||
    (options?.Google?.Enabled ? (options.Google.WebClientID ?? "") : "");
  const appleServiceID = options?.Apple?.Enabled
    ? (options.Apple.ServiceID ?? "")
    : "";
  const telegram = hasTelegramInitData();
  const sso = isSsoAvailable();

  /**
   * «Continue with iDos Games»: сначала уже имеющаяся сессия, и только без неё — за новым кодом на
   * сайт (решение владельца 02.10.2026). Новый вход — это новая сессия в движке, а лимит устройств
   * тайтла по умолчанию одно: лишний вход вытесняет живую сессию этого же игрока (другую вкладку,
   * телефон) и стоит ухода со страницы. Живой refresh-токен продлевается одним запросом.
   *
   * Без живого токена `autoLogin()` для входа через iDos Games просто отказывает — в гостя он не
   * уводит (`replay` такой вход не повторяет), поэтому дальше идёт обычный уход на /sso.
   */
  const continueWithIdosGames = async (): Promise<void> => {
    if (client.auth.lastAuthType === AuthType.iDosGames) {
      setBusy(true);
      setError(null);
      const resumed = await client.auth.autoLogin();
      if (resumed.ok) {
        onAuthenticated();
        return;
      }
      setBusy(false);
    }
    beginSsoRedirect({ titleID: client.titleID });
  };

  /** Every provider goes through here, so one place owns the busy flag and the error surface. */
  const run = async (
    login: () => Promise<{ ok: boolean; error?: string }>,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    // "Remember me" is read when the login completes, so set it before starting one. Off = this
    // session works normally but is not written to storage, so the next launch lands here again.
    client.auth.setRememberSession(remember);
    const result = await login();
    if (result.ok) {
      onAuthenticated();
      return;
    }
    setError(result.error ? authErrorText(t, result.error) : t("failed"));
    setBusy(false);
  };

  /**
   * Регистрация — единственный провайдер, который НЕ обязательно заканчивается входом.
   *
   * Когда тайтл требует подтверждения адреса (а это значение платформы), сервер только отправляет
   * код, и аккаунта ещё нет. Поэтому она идёт мимо `run`: тот на успехе сразу зовёт
   * `onAuthenticated()`, а здесь на успехе надо показать экран ввода кода.
   */
  const register = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    client.auth.setRememberSession(remember);

    const result = await client.auth.registerWithEmail(email, password);

    if (!result.ok) {
      setError(
        result.error ? authErrorText(t, result.error) : t("signUpFailed"),
      );
      setBusy(false);
      return;
    }

    // Аккаунта ещё нет — он появится на подтверждении. Уйти в игру здесь значило бы показать
    // пустую сессию.
    setCode("");

    // Паузу задаёт СЕРВЕР (её настраивает издатель), поэтому запоминаем её и дальше берём
    // отсюда. Раньше первый отсчёт шёл от ответа, а каждый следующий — от захардкоженных 60
    // секунд: у тайтла с другой настройкой кнопка либо открывалась раньше, чем сервер согласен
    // слать (нажатие впустую, ответ всё равно успешный), либо держалась закрытой дольше нужного.
    const cooldown = result.data.resendCooldownSeconds ?? 0;
    setResendCooldown(cooldown > 0 ? cooldown : DEFAULT_RESEND_COOLDOWN);

    setResendIn(cooldown);
    setMode("verify");
    setBusy(false);
  };

  const resendCode = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await client.auth.resendVerificationCode(email);

    // Ответ почти всегда успешный — начата регистрация или нет, выдержана пауза или нет. Иначе
    // эта кнопка отвечала бы на вопрос «заведён ли такой адрес». Поэтому и таймер заводим всегда.
    //
    // ⚠ Но ОДИН отказ отсюда приходит и его нельзя глотать: «слать нечем» (у тайтла и у
    // платформы нет отправителя). Он про конфигурацию сервера, а не про адрес, поэтому и
    // безопасен, и обязателен — иначе игрок жмёт кнопку до посинения, ожидая письма, которого
    // никто не отправлял.
    if (!result.ok) setError(authErrorText(t, result.error));

    setResendIn(resendCooldown);
    setBusy(false);
  };

  // Обратный отсчёт до следующей отправки. Без него игрок жмёт «ещё раз» вслепую, а сервер молча
  // отказывает — и выглядит это как сломанная кнопка.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      await loadScript(GOOGLE_SCRIPT);
    } catch {
      // Handled below: no global means the script is unavailable.
    }
    const google = (globalThis as { google?: GoogleIdentity }).google;
    if (!google) {
      setError(t("googleNoScript"));
      return;
    }
    setError(null);
    google.accounts.id.initialize({
      client_id: googleClientID,
      callback: (response) => {
        if (!response.credential) {
          setError(t("googleCancelled"));
          return;
        }
        void run(() => client.auth.loginWithGoogle(response.credential ?? ""));
      },
    });
    google.accounts.id.prompt();
  };

  const signInWithApple = async (): Promise<void> => {
    setError(null);
    try {
      await loadScript(APPLE_SCRIPT);
    } catch {
      setError(t("appleNoScript"));
      return;
    }
    const apple = (globalThis as { AppleID?: AppleIdentity }).AppleID;
    if (!apple) {
      setError(t("appleNoScript"));
      return;
    }
    const nonce = randomNonce();
    apple.auth.init({
      clientId: appleServiceID,
      scope: "name email",
      // Must be a return URL registered for this Services ID; with a popup Apple only checks it.
      redirectURI: `${window.location.origin}/`,
      usePopup: true,
      nonce,
    });
    try {
      const response = await apple.auth.signIn();
      const name = [
        response.user?.name?.firstName,
        response.user?.name?.lastName,
      ]
        .filter(Boolean)
        .join(" ");
      await run(() =>
        client.auth.loginWithApple(response.authorization.id_token, {
          nonce,
          name,
        }),
      );
    } catch {
      // The player closed Apple's window - nothing to report.
    }
  };

  /** "Forgot password": the server e-mails a code; the next step sets the new password with it. */
  const sendResetCode = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await client.auth.forgotPassword(email);
    setBusy(false);
    // Like the resend: the answer does not say whether the address has an account - except "there
    // is nothing to send with", which is about the server and must be shown.
    if (!result.ok && result.error === "EMAIL_SENDER_NOT_CONFIGURED") {
      setError(authErrorText(t, result.error));
      return;
    }
    setCode("");
    setPassword("");
    setMode("reset");
  };

  const resetPassword = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await client.auth.resetPassword(
      email,
      code.trim(),
      password,
    );
    setBusy(false);
    if (!result.ok) {
      setError(authErrorText(t, result.error));
      return;
    }
    setPassword("");
    setNotice(t("passwordChanged"));
    setMode("email");
  };

  /** A text link under the buttons (switch form, forgot password, back). */
  const link = (
    label: string,
    onClick: () => void,
    disabled = busy,
  ): ReactNode => (
    <button
      type="button"
      className="ccl-link"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
  const back = (to: Mode): ReactNode =>
    link(t("back"), () => {
      setMode(to);
      setError(null);
    });
  const icon = (src: string): ReactNode => (
    <img className="ccl-btn-icon" src={src} alt="" />
  );
  /** A hint with the e-mail address emphasised where the sentence has {email}. */
  const withEmail = (key: "verifyHint" | "resetHint"): ReactNode => {
    const [before, after] = t(key, { email: "\u0000" }).split("\u0000");
    return (
      <p className="ccl-hint">
        {before}
        <strong>{email}</strong>
        {after}
      </p>
    );
  };

  return (
    <div className="ccl-root" lang={lang}>
      <style>{LOGIN_CSS}</style>
      <LoginBackdrop />
      <div className="ccl-scroll">
        <main className="ccl-col">
          <div className="ccl-brand">
            <div className="ccl-hero" aria-hidden="true">
              <div className="ccl-glow" />
              <div className="ccl-shadow" />
              <div className="ccl-chest ccl-float">
                <Sprite strip={VAULT} scale="var(--hs)" crop={VAULT_ART} />
                <Sprite
                  strip={KEY}
                  scale="var(--hs)"
                  crop={KEY_ART}
                  className="ccl-key"
                />
              </div>
            </div>

            <h1 className="ccl-logo" aria-label="Casecremental">
              <span className="ccl-logo-case">CASE</span>
              <span className="ccl-logo-rest">CREMENTAL</span>
            </h1>
            <p className="ccl-tagline">{t("tagline")}</p>
          </div>

          <div className="ccl-side">
            <section className="ccl-panel" aria-label={t("signIn")}>
              <h2 className="ccl-panel-title">{t("signIn")}</h2>

              {mode === "menu" && (
                <div className="ccl-stack">
                  <div className="ccl-wallet">
                    {renderWalletLogin?.({
                      client,
                      onAuthenticated,
                      disabled: busy,
                      label: t("wallet"),
                      // The wallet package draws this button and takes only a style; its defaults are
                      // inline, so the fill, padding and corners are overridden here, while the bevel and
                      // the hover/press come from `.ccl-wallet > button` (./loginCss). One `background`
                      // shorthand (the icon over the fill), never mixed with background longhands.
                      style: {
                        background: `url("${icons.wallet}") no-repeat 12px center / 20px 20px, #ffd34d`,
                        color: INK,
                        padding: "10px 40px",
                        borderRadius: 0,
                        fontWeight: 400,
                        minHeight: 48,
                      },
                    })}
                  </div>

                  {/* Вход платформенным аккаунтом: уходим на idosgames.com/sso и возвращаемся сюда
                    с одноразовым кодом, который AuthGate обменяет сам. Кнопка нужна только тем,
                    кто открыл игру НАПРЯМУЮ. Скрыта там, где SSO заведомо откажет (превью,
                    localhost) — см. isSsoAvailable. */}
                  {sso && (
                    <button
                      type="button"
                      className="ccl-btn"
                      onClick={() => void continueWithIdosGames()}
                      disabled={busy}
                    >
                      {icon(icons.idos)}
                      {t("idos")}
                    </button>
                  )}

                  {walletOnly && sso && (
                    <p className="ccl-hint">{t("walletOnlyIdos")}</p>
                  )}

                  {!walletOnly && googleClientID && (
                    <button
                      type="button"
                      className="ccl-btn"
                      onClick={() => void signInWithGoogle()}
                      disabled={busy}
                    >
                      {icon(icons.google)}
                      {t("google")}
                    </button>
                  )}

                  {!walletOnly && appleServiceID && (
                    <button
                      type="button"
                      className="ccl-btn"
                      onClick={() => void signInWithApple()}
                      disabled={busy}
                    >
                      {icon(icons.apple)}
                      {t("apple")}
                    </button>
                  )}

                  {!walletOnly && telegram && (
                    <button
                      type="button"
                      className="ccl-btn"
                      onClick={() =>
                        void run(() => client.auth.loginWithTelegram())
                      }
                      disabled={busy}
                    >
                      {icon(icons.telegram)}
                      {t("telegram")}
                    </button>
                  )}

                  {!walletOnly && (
                    <button
                      type="button"
                      className="ccl-btn"
                      onClick={() => setMode("email")}
                      disabled={busy}
                    >
                      {icon(icons.email)}
                      {t("email")}
                    </button>
                  )}

                  {guestAllowed && (
                    <button
                      type="button"
                      className="ccl-btn"
                      onClick={() =>
                        void run(() => client.auth.loginWithDeviceID())
                      }
                      disabled={busy}
                    >
                      {icon(icons.guest)}
                      {busy ? t("signingIn") : t("guest")}
                    </button>
                  )}
                </div>
              )}

              {mode === "email" && (
                <div className="ccl-stack">
                  <input
                    className="ccl-input"
                    type="email"
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    autoFocus
                  />
                  <input
                    className="ccl-input"
                    type="password"
                    autoComplete={
                      registering ? "new-password" : "current-password"
                    }
                    placeholder={t("passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="ccl-btn ccl-primary"
                    onClick={() =>
                      registering
                        ? void register()
                        : void run(() =>
                            client.auth.loginWithEmail(email, password),
                          )
                    }
                    disabled={busy || !email || !password}
                  >
                    {busy
                      ? t("wait")
                      : registering
                        ? t("createAccount")
                        : t("doSignIn")}
                  </button>
                  {link(registering ? t("toSignIn") : t("toCreate"), () =>
                    setRegistering((r) => !r),
                  )}
                  {!registering &&
                    link(t("forgot"), () => {
                      setMode("forgot");
                      setError(null);
                      setNotice(null);
                    })}
                  {back("menu")}
                </div>
              )}

              {mode === "verify" && (
                <div className="ccl-stack">
                  {withEmail("verifyHint")}
                  <input
                    className="ccl-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t("codePlaceholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={busy}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="ccl-btn ccl-primary"
                    onClick={() =>
                      void run(() =>
                        client.auth.confirmEmailRegistration(email, code),
                      )
                    }
                    disabled={busy || !code}
                  >
                    {busy ? t("wait") : t("confirm")}
                  </button>
                  {link(
                    resendIn > 0 ? t("resendIn", { n: resendIn }) : t("resend"),
                    () => void resendCode(),
                    busy || resendIn > 0,
                  )}
                  {back("email")}
                </div>
              )}

              {mode === "forgot" && (
                <div className="ccl-stack">
                  <p className="ccl-hint">{t("forgotHint")}</p>
                  <input
                    className="ccl-input"
                    type="email"
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="ccl-btn ccl-primary"
                    onClick={() => void sendResetCode()}
                    disabled={busy || !email}
                  >
                    {busy ? t("wait") : t("sendCode")}
                  </button>
                  {back("email")}
                </div>
              )}

              {mode === "reset" && (
                <div className="ccl-stack">
                  {withEmail("resetHint")}
                  <input
                    className="ccl-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t("resetCodePlaceholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={busy}
                    autoFocus
                  />
                  <input
                    className="ccl-input"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("newPasswordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="ccl-btn ccl-primary"
                    onClick={() => void resetPassword()}
                    disabled={busy || !code || !password}
                  >
                    {busy ? t("wait") : t("setPassword")}
                  </button>
                  {back("forgot")}
                </div>
              )}

              {notice && !error && <p className="ccl-hint">{notice}</p>}

              {/* Applies to every provider above: remembered sessions come back by their refresh token. */}
              <label
                className="ccl-remember"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <input
                  type="checkbox"
                  checked={remember}
                  disabled={busy}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className={remember ? "ccl-tick on" : "ccl-tick"}>
                  <PixelGlyph
                    g={remember ? ICONS.tickOn : ICONS.tickOff}
                    cell="2px"
                  />
                </span>
                {t("remember")}
              </label>

              {error && (
                <p className="ccl-error" role="alert">
                  {error}
                </p>
              )}
            </section>

            <div className="ccl-lang" role="group" aria-label="Language / Язык">
              {(["en", "ru"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => pickLang(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
