import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import { placeholderMeta, SpriteLibrary, spriteIndex } from "./sprites";

describe("sprite index", () => {
  it("lists the built sprites with their meta and URL", () => {
    const idx = spriteIndex();
    const bot = idx.get("bot-open");
    expect(bot?.meta.frames).toBe(8);
    expect(bot?.meta.eyes).toHaveLength(8);
    expect(typeof bot?.url).toBe("string");
  });

  it("has a built 4-frame box for every case (case-<id>, Run 4's Glitch and Fever Dream included)", () => {
    const idx = spriteIndex();
    for (const c of CASES) expect(idx.get(`case-${c.id}`)?.meta.frames, c.id).toBe(4);
  });

  it("makes a placeholder meta for a missing sprite", () => {
    expect(spriteIndex().has("does-not-exist")).toBe(false);
    expect(placeholderMeta("x", 24, 20, 4)).toEqual({ id: "x", frames: 4, frameW: 24, frameH: 20, ground: 19, eyes: null });
  });

  it("a built sprite that fails to load is skipped, and the game still starts", async () => {
    const lib = await SpriteLibrary.load(async () => {
      throw new Error("decode failed");
    });
    expect(lib.has("bot-open")).toBe(false); // drawn as a placeholder instead
  });
});
