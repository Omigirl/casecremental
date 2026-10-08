import { describe, expect, it } from "vitest";
import manifest from "../../../../../art/manifest.json";
import { SOUNDS } from "./sounds";

// Every sound the game plays has a generation prompt in art/manifest.json, and nothing extra.
describe("audio manifest", () => {
  const sfx = manifest.audio.filter((a) => a.kind === "sfx");
  const music = manifest.audio.filter((a) => a.kind === "music");

  it("lists exactly the game's sound effects, with 1–5 variants each", () => {
    expect(sfx.map((a) => a.id).sort()).toEqual(Object.keys(SOUNDS).sort());
    for (const a of sfx) {
      expect(a.variants, a.id).toBeGreaterThanOrEqual(1);
      expect(a.variants, a.id).toBeLessThanOrEqual(5);
      expect(a.duration, a.id).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("has the Sober and Buzzed loops at the shared tempo", () => {
    expect(music.map((a) => a.stage)).toEqual([1, 2]);
    for (const a of music) expect(a.prompt).toContain("120 BPM");
  });
});
