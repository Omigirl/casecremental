// English UI strings. Keys are grouped by where they appear; budgets.ts limits their length,
// because Press Start 2P is wide and monospaced. {name} placeholders are filled by t().
export const EN = {
  "hud.combo": "COMBO x{mult}",
  "hud.next": "NEXT: {name}",
  "hud.settings": "SETTINGS",
  "panel.upgrades": "UPGRADES",
  "panel.cases": "CASES",
  "tab.you": "YOU",
  "tab.bot": "BOT",
  "tab.machines": "MACHINES",
  "tab.locked": "LOCKED",
  "btn.buy": "BUY",
  "btn.unlock": "UNLOCK",
  "btn.max": "MAX",
  "label.level": "LV {n}",
  "hint.buy": "Buy a case",
  "hint.key": "Drag the key",
  "hint.sell": "Drag to sell",
  "settings.title": "SETTINGS",
  "settings.language": "LANGUAGE",
  "settings.music": "MUSIC",
  "settings.sfx": "SOUNDS",
  "settings.close": "CLOSE",
  "station.offline": "OFFLINE",
} as const;

export type StringKey = keyof typeof EN;
