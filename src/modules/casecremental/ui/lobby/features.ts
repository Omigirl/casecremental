import type { FeatureRegistry } from "@idosgames/module-sdk";
import { onLangChange, t } from "../../i18n/index";
import { Leaderboard } from "./Leaderboard";
import { TrophyCase } from "./TrophyCase";

// The game's two lobby tabs (plan F7): the stock inventory and leaderboard modules could not be installed (the
// catalog was offline and src/modules.ts is platform-owned), so the game registers its own. Registered again when
// the language changes, so their labels follow it: register() replaces a feature by id, so an open tab stays open
// (unregistering first would close it).

export function registerLobbyTabs(features: FeatureRegistry): () => void {
  let off: Array<() => void> = [];
  const register = (): void => {
    off = [
      features.register({
        id: "casecremental-trophies",
        label: t("lobby.trophies"),
        icon: "🏆",
        group: "profile",
        order: 10,
        primary: true,
        Screen: TrophyCase,
      }),
      features.register({
        id: "casecremental-leaders",
        label: t("lobby.board"),
        icon: "📈",
        group: "social",
        order: 10,
        primary: true,
        Screen: Leaderboard,
      }),
    ];
  };
  register();
  const offLang = onLangChange(register);
  return () => {
    offLang();
    for (const f of off) f();
  };
}
