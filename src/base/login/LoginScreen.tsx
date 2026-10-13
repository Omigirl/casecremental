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
  detectLoginLang,
  loginMsgText,
  loginT,
  saveLoginLang,
  type LoginLang,
  type LoginMsg,
} from "./i18n";
import {
  glyphDataUrl,
  ICONS,
  PixelGlyph,
  Sprite,
  type Crop,
  type Strip,
} from "./pixelArt";
import {
  hasTelegramInitData,
  isSsoAvailable,
  promptGoogle,
  requestApple,
} from "./authProviders";
import { EmailFlow, type Mode } from "./components/EmailFlow";
import { ProviderMenu } from "./components/ProviderMenu";
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
// forgotPassword/resetPassword. The provider scripts and SSO check live in ./authProviders, the
// provider buttons in ./components/ProviderMenu, the e-mail forms in ./components/EmailFlow.
//
// A provider is only rendered when it can actually complete, so players never meet a dead button:
//   guest / email - always available, no external setup (guest only on an open title).
//   Google        - the title's own Google sign-in (platform setting) or VITE_IDOS_GOOGLE_CLIENT_ID;
//                   the Google Identity script is loaded on demand.
//   Apple         - when the title set up Sign in with Apple for the web (a Services ID).
//   Telegram      - only inside a Telegram Mini App (it signs in with the app's initData).
//   wallet        - always offered; ./walletLogin owns the wagmi config and the challenge network.
//   iDos Games    - only where the platform accepts a return_to (see isSsoAvailable).
//
// The title's login mode decides the rest (platform setting: Blockchain -> login mode):
//   Open                - every method;
//   AnyWithLinkedWallet - every method except guest (a guest cannot link a wallet);
//   WalletOnly          - the wallet and iDos Games only: an iDos Games account plays with a wallet
//                         linked to it (one wallet - one account), everything else is refused.

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

// Служебный код отказа → фраза для игрока: ./i18n loginMsgText (на двух языках). Без этого экран
// показывал бы коды КАК ЕСТЬ («EMAIL_SENDER_NOT_CONFIGURED»); незнакомый код возвращается как есть.
// Ошибка хранится КАК КЛЮЧ/КОД и переводится при отрисовке, поэтому переключатель EN/RU
// переписывает и уже показанное сообщение.

const INK = "#120e10";
const CREAM = "#fff6d5";
const DIM = "#a89a8c";
const VAULT: Strip = { url: vaultUrl, frameW: 68, frameH: 78, frames: 4 };
const KEY: Strip = { url: keyUrl, frameW: 16, frameH: 24, frames: 4 };
/** The closed chest and the key without the headroom of their animations (frame 0's art bounds). */
const VAULT_ART: Crop = { x: 13, y: 48, w: 44, h: 30 };
const KEY_ART: Crop = { x: 0, y: 12, w: 12, h: 12 };

const WALLET_STYLE = (walletIcon: string): CSSProperties => ({
  background: `url("${walletIcon}") no-repeat 12px center / 20px 20px, #ffd34d`,
  color: INK,
  padding: "10px 40px",
  borderRadius: 0,
  fontWeight: 400,
  minHeight: 48,
});

export function LoginScreen({
  client,
  onAuthenticated,
  renderWalletLogin,
}: LoginScreenProps & LoginScreenExtras): ReactNode {
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginMsg | null>(null);
  const [notice, setNotice] = useState<LoginMsg | null>(null);
  const [remember, setRemember] = useState(true);

  const [lang, setLang] = useState<LoginLang>(() => detectLoginLang());
  const t = useMemo(() => loginT(lang), [lang]);
  const pickLang = (next: LoginLang): void => {
    setLang(next);
    saveLoginLang(next);
  };
  // The page's language follows the screen's (screen readers, hyphenation, the browser's translate bar).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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
    setError(result.error ? { code: result.error } : { key: "failed" });
    setBusy(false);
  };

  const signInWithGoogle = async (): Promise<void> => {
    setError(null);
    const outcome = await promptGoogle(googleClientID, (credential) => {
      if (!credential) {
        setError({ key: "googleCancelled" });
        return;
      }
      void run(() => client.auth.loginWithGoogle(credential));
    });
    if (outcome === "noScript") setError({ key: "googleNoScript" });
  };

  const signInWithApple = async (): Promise<void> => {
    setError(null);
    const apple = await requestApple(appleServiceID);
    if (apple.status === "noScript") {
      setError({ key: "appleNoScript" });
      return;
    }
    if (apple.status === "closed") return;
    await run(() =>
      client.auth.loginWithApple(apple.idToken, {
        nonce: apple.nonce,
        name: apple.name,
      }),
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
                <ProviderMenu
                  client={client}
                  onAuthenticated={onAuthenticated}
                  renderWalletLogin={renderWalletLogin}
                  t={t}
                  busy={busy}
                  icons={icons}
                  walletStyle={WALLET_STYLE(icons.wallet)}
                  walletOnly={walletOnly}
                  guestAllowed={guestAllowed}
                  sso={sso}
                  googleClientID={googleClientID}
                  appleServiceID={appleServiceID}
                  telegram={telegram}
                  run={run}
                  onIdos={() => void continueWithIdosGames()}
                  onGoogle={() => void signInWithGoogle()}
                  onApple={() => void signInWithApple()}
                  onEmail={() => setMode("email")}
                />
              )}

              <EmailFlow
                client={client}
                mode={mode}
                setMode={setMode}
                t={t}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setNotice={setNotice}
                run={run}
                remember={remember}
              />

              {notice && !error && (
                <p className="ccl-hint" role="status">
                  {loginMsgText(t, notice)}
                </p>
              )}

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
                  {loginMsgText(t, error)}
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
