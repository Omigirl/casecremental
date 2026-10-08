import { describe, expect, it } from "vitest";
import type { PrestigeView } from "../game/view";
import { charmChoices, PRESTIGE_DELAY_MS, prestigeDelayMs } from "./prestigeRules";

const view = (over: Partial<PrestigeView>): PrestigeView => ({
  clout: 10,
  gained: 10,
  loops: 1,
  perks: [],
  offer: ["insider", "ricochet", "goldRush"],
  picked: [],
  slots: 1,
  ...over,
});

describe("the prestige screen", () => {
  it("lets you pick charms up to your slots, and un-pick a picked one", () => {
    expect(charmChoices(view({})).every((c) => c.enabled && !c.picked)).toBe(true);
    const one = charmChoices(view({ picked: ["ricochet"] }));
    expect(one.find((c) => c.id === "ricochet")).toEqual({ id: "ricochet", picked: true, enabled: true });
    expect(one.filter((c) => !c.picked).every((c) => !c.enabled)).toBe(true);
    expect(charmChoices(view({ picked: ["ricochet"], slots: 2 })).every((c) => c.enabled)).toBe(true);
  });

  it("waits for the vault's showcase only when you watched the run end; after a reload it shows at once (Review Focus 1)", () => {
    expect(prestigeDelayMs(true)).toBe(PRESTIGE_DELAY_MS);
    expect(prestigeDelayMs(false)).toBe(0);
    expect(PRESTIGE_DELAY_MS).toBeGreaterThan(2400); // the knife's 2.4 s flight plays first
  });
});
