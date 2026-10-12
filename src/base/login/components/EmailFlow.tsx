import { useEffect, useState, type ReactNode } from "react";
import type { LoginScreenProps } from "@idosgames/app-shell";
import type { LoginMsg, LoginT } from "../i18n";

/** Which form of the panel is open; "menu" is the provider list (./ProviderMenu). */
export type Mode = "menu" | "email" | "verify" | "forgot" | "reset";

/** Пауза повторной отправки, когда сервер её не назвал. Совпадает со значением платформы. */
const DEFAULT_RESEND_COOLDOWN = 60;

export type RunLogin = (
  login: () => Promise<{ ok: boolean; error?: string }>,
) => Promise<void>;

interface EmailFlowProps {
  client: LoginScreenProps["client"];
  mode: Mode;
  setMode: (mode: Mode) => void;
  t: LoginT;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setError: (error: LoginMsg | null) => void;
  setNotice: (notice: LoginMsg | null) => void;
  /** Signs in through one provider call: owns the busy flag, "remember me" and the error surface. */
  run: RunLogin;
  remember: boolean;
}

/** The e-mail forms: sign in / create account, the confirmation code, forgot and reset password. */
export function EmailFlow({
  client,
  mode,
  setMode,
  t,
  busy,
  setBusy,
  setError,
  setNotice,
  run,
  remember,
}: EmailFlowProps): ReactNode {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(DEFAULT_RESEND_COOLDOWN);

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
      setError(result.error ? { code: result.error } : { key: "signUpFailed" });
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
    if (!result.ok) setError({ code: result.error });

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

  /** "Forgot password": the server e-mails a code; the next step sets the new password with it. */
  const sendResetCode = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await client.auth.forgotPassword(email);
    setBusy(false);
    // Like the resend: the answer does not say whether the address has an account - except "there
    // is nothing to send with", which is about the server and must be shown.
    if (!result.ok && result.error === "EMAIL_SENDER_NOT_CONFIGURED") {
      setError({ code: result.error });
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
      setError({ code: result.error });
      return;
    }
    setPassword("");
    setNotice({ key: "passwordChanged" });
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

  // Always mounted (so the typed address survives a trip to the menu); the menu itself is ./ProviderMenu.
  if (mode === "menu") return null;

  if (mode === "email")
    return (
      <div className="ccl-stack">
        <input
          className="ccl-input"
          type="email"
          autoComplete="email"
          aria-label={t("emailPlaceholder")}
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <input
          className="ccl-input"
          type="password"
          autoComplete={registering ? "new-password" : "current-password"}
          aria-label={t("passwordPlaceholder")}
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
              : void run(() => client.auth.loginWithEmail(email, password))
          }
          disabled={busy || !email || !password}
        >
          {busy ? t("wait") : registering ? t("createAccount") : t("doSignIn")}
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
    );

  if (mode === "verify")
    return (
      <div className="ccl-stack">
        {withEmail("verifyHint")}
        <input
          className="ccl-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={t("codePlaceholder")}
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
            void run(() => client.auth.confirmEmailRegistration(email, code))
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
    );

  if (mode === "forgot")
    return (
      <div className="ccl-stack">
        <p className="ccl-hint">{t("forgotHint")}</p>
        <input
          className="ccl-input"
          type="email"
          autoComplete="email"
          aria-label={t("emailPlaceholder")}
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
    );

  return (
    <div className="ccl-stack">
      {withEmail("resetHint")}
      <input
        className="ccl-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={t("resetCodePlaceholder")}
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
        aria-label={t("newPasswordPlaceholder")}
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
  );
}
