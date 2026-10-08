import { describe, expect, it } from "vitest";
import { placeholderMeta, spriteIndex } from "./sprites";

describe("sprite index", () => {
  it("lists the built sprites with their meta and URL", () => {
    const idx = spriteIndex();
    const bot = idx.get("bot-open");
    expect(bot?.meta.frames).toBe(8);
    expect(bot?.meta.eyes).toHaveLength(8);
    expect(typeof bot?.url).toBe("string");
  });

  it("makes a placeholder meta for a missing sprite", () => {
    expect(spriteIndex().has("does-not-exist")).toBe(false);
    expect(placeholderMeta("x", 24, 20, 4)).toEqual({ id: "x", frames: 4, frameW: 24, frameH: 20, ground: 19, eyes: null });
  });
});
