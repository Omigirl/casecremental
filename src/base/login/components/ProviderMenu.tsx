import type { CSSProperties, ReactNode } from "react";
import type { LoginScreenProps } from "@idosgames/app-shell";
import type { LoginT } from "../i18n";
import type { RunLogin } from "./EmailFlow";
import type { LoginScreenExtras } from "../LoginScreen";

interface ProviderMenuProps {
  client: LoginScreenProps["client"];
  onAuthenticated: () => void;
  renderWalletLogin: LoginScreenExtras["renderWalletLogin"];
  t: LoginT;
  busy: boolean;
  icons: Record<"wallet" | "idos" | "google" | "apple" | "telegram" | "email" | "guest", string>;
  /** The wallet button's inline style (the wallet package takes only a style). */
  walletStyle: CSSProperties;
  // What the title and the environment allow (see LoginScreen).
  walletOnly: boolean;
  guestAllowed: boolean;
  sso: boolean;
  googleClientID: string;
  appleServiceID: string;
  telegram: boolean;
  run: RunLogin;
  onIdos: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onEmail: () => void;
}

/** The provider buttons of the panel: only the ones that can actually complete are rendered. */
export function ProviderMenu(props: ProviderMenuProps): ReactNode {
  const {
    client,
    onAuthenticated,
    renderWalletLogin,
    t,
    busy,
    icons,
    walletStyle,
    walletOnly,
    guestAllowed,
    sso,
    googleClientID,
    appleServiceID,
    telegram,
    run,
  } = props;
  const icon = (src: string): ReactNode => (
    <img className="ccl-btn-icon" src={src} alt="" />
  );
  const button = (
    onClick: () => void,
    src: string,
    label: string,
  ): ReactNode => (
    <button type="button" className="ccl-btn" onClick={onClick} disabled={busy}>
      {icon(src)}
      {label}
    </button>
  );

  return (
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
          style: walletStyle,
        })}
      </div>

      {/* Вход платформенным аккаунтом: уходим на idosgames.com/sso и возвращаемся сюда
        с одноразовым кодом, который AuthGate обменяет сам. Кнопка нужна только тем,
        кто открыл игру НАПРЯМУЮ. Скрыта там, где SSO заведомо откажет (превью,
        localhost) — см. isSsoAvailable. */}
      {sso && button(props.onIdos, icons.idos, t("idos"))}

      {walletOnly && sso && <p className="ccl-hint">{t("walletOnlyIdos")}</p>}

      {!walletOnly &&
        googleClientID &&
        button(props.onGoogle, icons.google, t("google"))}

      {!walletOnly &&
        appleServiceID &&
        button(props.onApple, icons.apple, t("apple"))}

      {!walletOnly &&
        telegram &&
        button(
          () => void run(() => client.auth.loginWithTelegram()),
          icons.telegram,
          t("telegram"),
        )}

      {!walletOnly && button(props.onEmail, icons.email, t("email"))}

      {guestAllowed &&
        button(
          () => void run(() => client.auth.loginWithDeviceID()),
          icons.guest,
          busy ? t("signingIn") : t("guest"),
        )}
    </div>
  );
}
