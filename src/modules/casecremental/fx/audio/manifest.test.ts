import { describe, expect, it } from "vitest";
import manifest from "../../../../../art/manifest.json";
import { SOUNDS, TRACK_GAIN } from "./sounds";

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

  const FILES = import.meta.glob("../../assets/audio/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
  const hasFile = (id: string) => Object.keys(FILES).some((p) => p.endsWith(`/${id}.mp3`));

  it("has every stage's loops at the shared tempo — three each for stages 3–5 — and Run 4's finale (finish spec §6)", () => {
    const stageLoops = music.filter((a) => a.stage !== undefined && a.fromRun === undefined);
    expect([1, 2, 3, 4, 5].map((s) => stageLoops.filter((a) => a.stage === s).length)).toEqual([1, 1, 3, 3, 3]);
    const finale = music.filter((a) => a.fromRun !== undefined);
    expect(finale.map((a) => [a.id, a.stage, a.fromRun])).toEqual([["music-finale", 5, 4]]);
    for (const a of [...stageLoops, ...finale]) {
      expect(a.prompt, a.id).toContain("120 BPM");
      expect(hasFile(a.id), `${a.id}.mp3 in assets/audio`).toBe(true);
    }
  });

  it("has the named tracks, none of them a stage loop", () => {
    for (const id of Object.keys(TRACK_GAIN)) {
      const track = music.find((a) => a.id === id);
      expect(track, id).toBeDefined();
      expect(track?.stage, id).toBeUndefined();
    }
  });
});
