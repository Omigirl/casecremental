// Character budgets per key group. Press Start 2P is monospaced: width = characters × font size,
// so a character budget is a width budget. Placeholders are excluded before measuring.
const BY_PREFIX: Array<[string, number]> = [
  ["hud.", 16],
  ["panel.", 12],
  ["tab.", 10],
  ["lobby.", 52], // the lobby tabs (plan F7): DOM text in the host's kit, not the pixel font's narrow columns
  ["btn.", 8],
  ["label.", 8],
  ["hint.", 18],
  ["settings.", 12],
  ["station.", 10],
  ["bot.", 20],
  ["seller.", 20],
  ["vault.", 24],
  ["float.", 12],
  ["prestige.", 24],
  ["credits.", 24], // the credits' scroll: heads and stat lines (names and the best drop wrap by word)
  ["cap.", 11], // a maxed button's NEXT RUN (an 11-character panel line)
  ["locker.", 20],
  ["upgrader.", 20],
  ["evo.", 24],
  ["autospin.", 20],
  ["brings.", 24], // the prestige screen's "what the next run brings" lines
  ["shelf.", 20],
  ["tut.skip", 20],
  ["tut.ok", 8],
  ["tut.replay", 16], // a Settings button
  ["tut.", 60], // a bubble: at most 3 lines of 24 characters (ui/tutorialPlace.ts BUBBLE_CHARS)
  ["card.title", 24],
  ["card.tap", 24],
  ["card.", 150], // a new-run card's paragraph wraps inside the card
  // content names (content.ts)
  ["case.lastcase", 14],
  ["case.vault", 14],
  ["case.", 12],
  ["weapon.", 18],
  ["skin.", 22],
  ["rarity.", 18],
  ["wear.", 18],
  ["upgrade.name.", 12], // a single word cannot wrap on the upgrades board
  ["upgrade.desc.", 20],
  ["stage.", 16],
  ["charm.name.", 18],
  ["charm.desc.", 32],
  ["perk.name.", 18],
  ["perk.desc.", 32],
];

export function budgetFor(key: string): number {
  const hit = BY_PREFIX.find(([p]) => key.startsWith(p));
  if (!hit) throw new Error(`no budget for ${key}`);
  return hit[1];
}

export const fitsBudget = (text: string, budget: number): boolean => [...text].length <= budget;
