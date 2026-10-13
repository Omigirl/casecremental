// Provider plumbing of the sign-in screen (./LoginScreen): where the platform accepts an SSO return,
// the Google / Apple / Telegram scripts and their requests. No React here.

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

export function isSsoAvailable(): boolean {
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
export function hasTelegramInitData(): boolean {
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

/**
 * Opens Google's one-tap prompt. `onCredential` later gets the credential, or null when the player
 * dismissed it. Resolves "noScript" when Google's script is unavailable, else "prompted".
 */
export async function promptGoogle(
  clientID: string,
  onCredential: (credential: string | null) => void,
): Promise<"noScript" | "prompted"> {
  try {
    await loadScript(GOOGLE_SCRIPT);
  } catch {
    // Handled below: no global means the script is unavailable.
  }
  const google = (globalThis as { google?: GoogleIdentity }).google;
  if (!google) return "noScript";
  google.accounts.id.initialize({
    client_id: clientID,
    callback: (response) => onCredential(response.credential || null),
  });
  google.accounts.id.prompt();
  return "prompted";
}

export type AppleResult =
  | { status: "noScript" }
  | { status: "closed" }
  | { status: "ok"; idToken: string; nonce: string; name: string };

/** Apple's popup: the signed id token with the nonce it carries and the name Apple shared, if any. */
export async function requestApple(serviceID: string): Promise<AppleResult> {
  try {
    await loadScript(APPLE_SCRIPT);
  } catch {
    return { status: "noScript" };
  }
  const apple = (globalThis as { AppleID?: AppleIdentity }).AppleID;
  if (!apple) return { status: "noScript" };
  const nonce = randomNonce();
  apple.auth.init({
    clientId: serviceID,
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
    return {
      status: "ok",
      idToken: response.authorization.id_token,
      nonce,
      name,
    };
  } catch {
    // The player closed Apple's window - nothing to report.
    return { status: "closed" };
  }
}
