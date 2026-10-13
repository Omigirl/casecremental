import { makeT } from "@idosgames/react/ui";
import { detectLoginLang, type LoginLang } from "../login/i18n";

// Strings of the lobby. Names of currencies, items and the rest are the publisher's words (title
// config), and every tab's label is its module's own.
//
// The language is the one the game and the sign-in screen use (../login/i18n detectLoginLang): the
// player's pick stored with the game's prefs, else the browser language. It is read on every call,
// so a pick made in the game shows here as soon as the lobby draws again. (The SDK's makeT alone
// follows only the browser, which put "Играть" next to the game's English tabs.)

const EN = {
  lobby: "Lobby",
  toLobby: "To the lobby",
  play: "Play",
  withFriends: "With friends",
  more: "More",
  profile: "Profile",
  playerId: "Player ID",
  copyId: "Copy ID",
  copied: "Copied",
  logout: "Log out",
  wallet: "Wallet",
  back: "Back",
  noFeatures:
    "Nothing to show yet. Tabs appear as the app's modules (shop, heroes, leaderboards…) get their settings on the title.",
} as const;

export type StringKey = keyof typeof EN;

const RU: Record<StringKey, string> = {
  lobby: "Лобби",
  toLobby: "В лобби",
  play: "Играть",
  withFriends: "С друзьями",
  more: "Ещё",
  profile: "Профиль",
  playerId: "ID игрока",
  copyId: "Скопировать ID",
  copied: "Скопировано",
  logout: "Выйти",
  wallet: "Кошелёк",
  back: "Назад",
  noFeatures:
    "Пока здесь пусто. Вкладки появляются, когда модулям приложения (магазин, герои, лидеры…) заданы настройки в тайтле.",
};

const TABLES: Record<LoginLang, (key: StringKey) => string> = {
  en: makeT<StringKey>(EN, RU, "en"),
  ru: makeT<StringKey>(EN, RU, "ru"),
};

/** The lobby's string table of a language. */
export const lobbyT = (lang: LoginLang): ((key: StringKey) => string) =>
  TABLES[lang];

/** A lobby string in the game's language. */
export const t = (key: StringKey): string => TABLES[detectLoginLang()](key);
