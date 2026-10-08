import { describe, expect, it } from "vitest";
import { SkinPlayer } from "./player";

describe("SkinPlayer", () => {
  it("plays a loop by elapsed time and wraps around", () => {
    const p = new SkinPlayer(["a", "b", "c", "d"], 8);
    expect(p.frame).toBe("a");
    expect(p.advance(125)).toBe("b");
    expect(p.advance(250)).toBe("d");
    expect(p.advance(125)).toBe("a");
  });

  it("starts over from the first frame on reset (a new spin shows the skin still)", () => {
    const p = new SkinPlayer(["a", "b", "c"], 8);
    p.advance(250);
    p.reset();
    expect(p.frame).toBe("a");
  });

  it("a still skin is one frame, whatever the time", () => {
    const p = new SkinPlayer(["only"], 8);
    expect(p.moving).toBe(false);
    expect(p.advance(10_000)).toBe("only");
  });
});
