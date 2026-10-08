// Character budgets per key group. Press Start 2P is monospaced: width = characters × font size,
// so a character budget is a width budget. Placeholders are excluded before measuring.
const BY_PREFIX: Array<[string, number]> = [
  ["hud.", 16],
  ["panel.", 12],
  ["tab.", 10],
  ["btn.", 8],
  ["label.", 8],
  ["hint.", 18],
  ["settings.", 12],
  ["station.", 10],
  ["bot.", 20],
  ["seller.", 20],
  ["float.", 12],
  ["prestige.", 24],
  // content names (content.ts)
  ["case.", 12],
  ["weapon.", 18],
  ["skin.", 22],
  ["rarity.", 18],
  ["wear.", 18],
  ["upgrade.name.", 14],
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
