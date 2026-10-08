import { describe, expect, it } from "vitest";
import { actorParts, eyePositions } from "./Actor";
import { placeholderMeta } from "./sprites";

const POSE = { frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open" as const, look: 0 };

describe("actor bands", () => {
  it("draws a plain sprite as one part", () => {
    expect(actorParts(20, { dy: -2, bodyDy: 0, headDy: 0 })).toEqual([{ srcY: 0, h: 20, dy: -2 }]);
  });

  it("splits a character into legs, body and a head one row taller, bobbing out of step", () => {
    const parts = actorParts(62, { dy: 0, bodyDy: 1, headDy: -1 }, { headEnd: 30, bodyEnd: 46 });
    expect(parts).toEqual([
      { srcY: 46, h: 16, dy: 0 },
      { srcY: 30, h: 16, dy: 1 },
      { srcY: 0, h: 31, dy: 0 },
    ]);
  });

  it("moves the eyes with the head band and the look", () => {
    const meta = {
      ...placeholderMeta("bot", 51, 62, 2),
      eyes: [
        [
          [30, 30],
          [36, 30],
        ] as [number, number][],
        null,
      ],
    };
    expect(eyePositions(meta, { ...POSE, bodyDy: 1, headDy: -2, look: 1 })).toEqual([
      { x: 31, y: 29 },
      { x: 37, y: 29 },
    ]);
    expect(eyePositions(meta, { ...POSE, frame: 1 })).toEqual([]);
  });
});
