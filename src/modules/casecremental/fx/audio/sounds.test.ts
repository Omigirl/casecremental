import { describe, expect, it } from "vitest";
import { indexAudio, SOUNDS, TRACK_GAIN, type TrackId } from "./sounds";

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
      "coin-fountain",
      "firework",
      "legendary-choir",
      "blackout",
      "light-flicker",
      "light-on",
      "charm-pick",
      "perk-buy",
      "run-start",
    ])
      expect(SOUNDS).toHaveProperty(id);
  });
});

const REAL_FILES = import.meta.glob("../../assets/audio/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

describe("the named tracks", () => {
  it("plays Vaults II and III's fanfares at Vault I's level (their re-cuts are level-matched, plan M3-C)", () => {
    expect(TRACK_GAIN["vault-fanfare-2"]).toBe(TRACK_GAIN["vault-fanfare"]);
    expect(TRACK_GAIN["vault-fanfare-3"]).toBe(TRACK_GAIN["vault-fanfare"]);
  });

  it("finds every named track's file in assets/audio", () => {
    const files = indexAudio(REAL_FILES);
    for (const id of Object.keys(TRACK_GAIN) as TrackId[]) expect(files.tracks.get(id), id).toBeDefined();
    expect(files.tracks.get("vault-fanfare")).toMatch(/vault-fanfare-1/);
    expect(files.tracks.get("vault-fanfare-2")).toMatch(/vault-fanfare-2/);
    expect(files.tracks.get("vault-fanfare-3")).toMatch(/vault-fanfare-3/);
  });
});
