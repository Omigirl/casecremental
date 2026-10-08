import { describe, expect, it } from "vitest";
import { SOUNDS } from "./sounds";

describe("SOUNDS", () => {
  it("lists every sound the rework uses", () => {
    for (const id of [
      "bot-reel-spin",
      "bot-wake",
      "seller-power-on",
      "seller-sell",
      "dayjob-work",
      "dayjob-pay",
      "dayjob-nopay",
      "tray-store",
      "stage-up",
      "vault-slam",
      "vault-rumble",
      "devil-key-whisper",
      "devil-key-laugh",
      "vault-lock-spin",
      "chain-snap",
      "light-burst",
      "coin-fountain",
      "firework",
      "vault-reel-land",
      "legendary-choir",
      "blackout",
      "light-flicker",
      "light-on",
      "charm-pick",
      "perk-buy",
      "run-start",
      "reel-spinup",
    ])
      expect(SOUNDS).toHaveProperty(id);
  });
});
