// Strings of the sign-in screen, English and Russian. The base cannot import the game's i18n
// (src/modules/casecremental/i18n), so the screen keeps its own small table and follows the same rule:
// the language the player picked in the game, else the browser's first language (Russian → "ru").
//
// The game remembers the player's pick in localStorage under "casecremental:prefs" ({ lang: "en" | "ru"
// | null, … }, src/modules/casecremental/ui/prefs.ts). The screen reads that field, and its EN/RU toggle
// writes only that field back (every other field kept), so a language chosen here is the game's too.
// Storage may be missing or blocked (private windows, embeds): then the browser language decides.
//
// Button labels are short on purpose: Press Start 2P is wide and monospaced, and every label must fit
// a 390-px phone at 16 px.

export type LoginLang = "en" | "ru";

const EN = {
  tagline: "Open cases. Sell skins. Lose your mind.",
  signIn: "SIGN IN",
  wallet: "SOLANA WALLET",
  idos: "IDOS GAMES",
  google: "GOOGLE",
  apple: "APPLE",
  telegram: "TELEGRAM",
  email: "E-MAIL",
  guest: "PLAY AS GUEST",
  signingIn: "SIGNING IN…",
  wait: "WAIT…",
  emailPlaceholder: "E-mail",
  passwordPlaceholder: "Password",
  codePlaceholder: "Code",
  resetCodePlaceholder: "Code from the e-mail",
  newPasswordPlaceholder: "New password",
  doSignIn: "SIGN IN",
  createAccount: "CREATE ACCOUNT",
  toCreate: "Create an account",
  toSignIn: "I already have an account",
  forgot: "Forgot password?",
  back: "Back",
  confirm: "CONFIRM",
  resendIn: "Send again in {n}s",
  resend: "Send the code again",
  sendCode: "SEND THE CODE",
  setPassword: "SET PASSWORD",
  remember: "Remember me",
  verifyHint:
    "We sent a code to {email}. Enter it to finish creating your account.",
  forgotHint: "Enter your e-mail - we will send a code to set a new password.",
  resetHint:
    "If {email} has an account, a code is on its way. Enter it and choose a new password.",
  passwordChanged: "Password changed. Sign in with the new one.",
  walletOnlyIdos:
    "Signing in with iDos Games? Link your wallet after that - the game is played with a wallet.",
  googleNoScript:
    "Google sign-in is unavailable: the Google script did not load.",
  googleCancelled: "Google sign-in was cancelled.",
  appleNoScript: "Apple sign-in is unavailable: the Apple script did not load.",
  failed: "Sign-in failed. Please try again.",
  signUpFailed: "Sign-up failed. Please try again.",
  "err.EMAIL_SENDER_NOT_CONFIGURED":
    "Sign-in by e-mail is unavailable in this game right now. Try another way to sign in.",
  "err.INVALID_VERIFICATION_CODE":
    "That code is not right. Check the e-mail and try again.",
  "err.VERIFICATION_CODE_ATTEMPTS_EXCEEDED":
    "Too many wrong attempts. Ask for a new code.",
  "err.INCORRECT_EMAIL_OR_PASSWORD": "Wrong e-mail or password.",
  "err.INCORRECT_EMAIL": "That does not look like an e-mail address.",
  "err.PASSWORD_LENGTH_INVALID":
    "The password must be 8 to 100 characters long.",
  "err.TOO_MANY_FAILED_ATTEMPTS":
    "Too many attempts. Please try again a little later.",
  "err.RATE_LIMIT_EXCEEDED": "Too many requests. Please try again in a moment.",
  "err.PLAY_ACCESS_WALLET_LOGIN_ONLY":
    "This game can only be entered with a crypto wallet or your iDos Games account.",
  "err.PLAY_ACCESS_WALLET_USED_BY_ANOTHER_ACCOUNT":
    "This wallet already plays with another account.",
  "err.WALLET_UNLINK_COOLDOWN":
    "This wallet was unlinked from another account less than 7 days ago. Try again after the 7 days.",
  "err.APPLE_EMAIL_MISSING":
    "Apple did not share an e-mail address. Try again and allow it, or use another way to sign in.",
  "err.PLAY_ACCESS_GUEST_DISABLED":
    "Guest play is off in this game. Sign in to link a crypto wallet.",
  "err.PLAY_ACCESS_CHECK_FAILED":
    "Could not check your token balance right now. Please try again in a moment.",
  "err.network":
    "No connection to the game server. Check the internet and try again.",
  "err.unknown": "Something went wrong. Please try again.",
} as const;

export type LoginStringKey = keyof typeof EN;

const RU: Record<LoginStringKey, string> = {
  tagline: "Открывай кейсы. Продавай скины. Сходи с ума.",
  signIn: "ВХОД",
  wallet: "КОШЕЛЁК SOLANA",
  idos: "IDOS GAMES",
  google: "GOOGLE",
  apple: "APPLE",
  telegram: "TELEGRAM",
  email: "ПОЧТА",
  guest: "ИГРАТЬ ГОСТЕМ",
  signingIn: "ВХОДИМ…",
  wait: "ЖДИТЕ…",
  emailPlaceholder: "Почта",
  passwordPlaceholder: "Пароль",
  codePlaceholder: "Код",
  resetCodePlaceholder: "Код из письма",
  newPasswordPlaceholder: "Новый пароль",
  doSignIn: "ВОЙТИ",
  createAccount: "СОЗДАТЬ",
  toCreate: "Создать аккаунт",
  toSignIn: "У меня уже есть аккаунт",
  forgot: "Забыли пароль?",
  back: "Назад",
  confirm: "ГОТОВО",
  resendIn: "Ещё раз через {n} с",
  resend: "Отправить код ещё раз",
  sendCode: "ПРИСЛАТЬ КОД",
  setPassword: "СОХРАНИТЬ",
  remember: "Запомнить меня",
  verifyHint:
    "Мы отправили код на {email}. Введите его, чтобы закончить регистрацию.",
  forgotHint: "Введите почту - мы пришлём код для нового пароля.",
  resetHint:
    "Если у {email} есть аккаунт, код уже в пути. Введите его и задайте новый пароль.",
  passwordChanged: "Пароль изменён. Войдите с новым.",
  walletOnlyIdos:
    "Входите через iDos Games? Потом привяжите кошелёк - в игру играют с кошельком.",
  googleNoScript: "Вход через Google недоступен: скрипт Google не загрузился.",
  googleCancelled: "Вход через Google отменён.",
  appleNoScript: "Вход через Apple недоступен: скрипт Apple не загрузился.",
  failed: "Не удалось войти. Попробуйте ещё раз.",
  signUpFailed: "Не удалось зарегистрироваться. Попробуйте ещё раз.",
  "err.EMAIL_SENDER_NOT_CONFIGURED":
    "Вход по почте в этой игре сейчас недоступен. Выберите другой способ.",
  "err.INVALID_VERIFICATION_CODE":
    "Код не подошёл. Проверьте письмо и попробуйте ещё раз.",
  "err.VERIFICATION_CODE_ATTEMPTS_EXCEEDED":
    "Слишком много неверных попыток. Запросите новый код.",
  "err.INCORRECT_EMAIL_OR_PASSWORD": "Неверная почта или пароль.",
  "err.INCORRECT_EMAIL": "Это не похоже на адрес почты.",
  "err.PASSWORD_LENGTH_INVALID": "Пароль должен быть от 8 до 100 символов.",
  "err.TOO_MANY_FAILED_ATTEMPTS":
    "Слишком много попыток. Попробуйте чуть позже.",
  "err.RATE_LIMIT_EXCEEDED": "Слишком много запросов. Попробуйте через минуту.",
  "err.PLAY_ACCESS_WALLET_LOGIN_ONLY":
    "В эту игру входят только с криптокошельком или аккаунтом iDos Games.",
  "err.PLAY_ACCESS_WALLET_USED_BY_ANOTHER_ACCOUNT":
    "Этот кошелёк уже играет с другим аккаунтом.",
  "err.WALLET_UNLINK_COOLDOWN":
    "Этот кошелёк отвязали от другого аккаунта меньше 7 дней назад. Попробуйте после 7 дней.",
  "err.APPLE_EMAIL_MISSING":
    "Apple не передал адрес почты. Попробуйте снова и разрешите это или выберите другой способ.",
  "err.PLAY_ACCESS_GUEST_DISABLED":
    "Гостевая игра здесь выключена. Войдите, чтобы привязать криптокошелёк.",
  "err.PLAY_ACCESS_CHECK_FAILED":
    "Не удалось проверить баланс токенов. Попробуйте через минуту.",
  "err.network":
    "Нет связи с сервером игры. Проверьте интернет и попробуйте ещё раз.",
  "err.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
};

export type LoginT = (
  key: LoginStringKey,
  vars?: Record<string, string | number>,
) => string;

/** The string table of a language, with {name} placeholders filled from `vars`. */
export function loginT(lang: LoginLang): LoginT {
  const table: Record<LoginStringKey, string> = lang === "ru" ? RU : EN;
  return (key, vars) => {
    const raw = table[key];
    return vars
      ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""))
      : raw;
  };
}

/**
 * A server refusal code → a sentence the player can read. An unknown code comes back as is, on
 * purpose: on a test stand it tells the publisher more than a generic "something went wrong".
 */
export function authErrorText(t: LoginT, code: string | undefined): string {
  if (!code) return t("err.unknown");
  // Not a server code: the client's own message when the request never got an answer.
  if (/internet connection/i.test(code)) return t("err.network");
  const key = `err.${code}`;
  return key in EN ? t(key as LoginStringKey) : code;
}

/**
 * A message the screen keeps by what it IS, not by its words: either one of the screen's own strings
 * (`key`) or a server refusal code (`code`). Translated at render, so the EN/RU toggle re-words a
 * message that is already on screen.
 */
export type LoginMsg =
  | { key: LoginStringKey }
  | { code: string | undefined };

/** The player-readable text of a stored message, in the language of `t`. */
export function loginMsgText(t: LoginT, msg: LoginMsg): string {
  return "key" in msg ? t(msg.key) : authErrorText(t, msg.code);
}

/** The game's prefs key (src/modules/casecremental/ui/prefs.ts PREFS_KEY). */
export const GAME_PREFS_KEY = "casecremental:prefs";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readPrefs(store: Store | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(GAME_PREFS_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The game's stored pick, else the first browser language: Russian → "ru", anything else → "en". */
export function detectLoginLang(
  store: Store | null = browserStore(),
  languages: readonly string[] = typeof navigator !== "undefined"
    ? navigator.languages
    : [],
): LoginLang {
  const stored = readPrefs(store).lang;
  if (stored === "en" || stored === "ru") return stored;
  return languages[0]?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

/** Remember the pick for the game too: only the `lang` field changes, everything else is kept. */
export function saveLoginLang(
  lang: LoginLang,
  store: Store | null = browserStore(),
): void {
  if (!store) return;
  try {
    store.setItem(
      GAME_PREFS_KEY,
      JSON.stringify({ ...readPrefs(store), lang }),
    );
  } catch {
    // full or blocked storage: the pick lasts for this screen only
  }
}
