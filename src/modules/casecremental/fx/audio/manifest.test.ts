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

  it("has the five stage loops at the shared tempo, and the named tracks", () => {
    const stageLoops = music.filter((a) => a.stage !== undefined);
    expect(stageLoops.map((a) => a.stage)).toEqual([1, 2, 3, 4, 5]);
    for (const a of stageLoops) expect(a.prompt, a.id).toContain("120 BPM");
    for (const id of ["vault-suspense", "vault-fanfare", "prestige"]) {
      const track = music.find((a) => a.id === id);
      expect(track, id).toBeDefined();
      expect(track?.stage, id).toBeUndefined();
    }
  });
});
