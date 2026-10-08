import { describe, expect, it } from "vitest";
import { BLACKOUT_SECONDS } from "../fx/vault/lights";
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

  it("waits for the blackout only when you watched the run end; after a reload it shows at once (Review Focus 1)", () => {
    expect(prestigeDelayMs(true)).toBe(PRESTIGE_DELAY_MS);
    expect(prestigeDelayMs(false)).toBe(0);
    expect(PRESTIGE_DELAY_MS).toBeGreaterThanOrEqual(BLACKOUT_SECONDS * 1000); // the blackout plays first
    expect(PRESTIGE_DELAY_MS).toBeLessThanOrEqual(BLACKOUT_SECONDS * 1000 + 500); // ...and the screen comes up right after it
  });
});
