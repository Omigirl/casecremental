import { describe, expect, it } from "vitest";
import { hsv, intoStage } from "./chaos";

describe("hsv", () => {
  it("maps hue, saturation and value to a colour (pinned)", () => {
    const cases: [number, number, number, number][] = [
      [0, 1, 1, 0xff0000],
      [1 / 3, 1, 1, 0x00ff00],
      [2 / 3, 1, 1, 0x0000ff],
      [0.5, 0, 1, 0xffffff],
      [0.1, 0.85, 1, 0xffa826],
      [-1 / 3, 1, 1, 0x0000ff], // the wheel wraps both ways
      [1.25, 0.55, 0.8, 0x94cc5c],
      [0.02, 0.35, 1, 0xffb0a6],
      [0.97, 0.7, 0.5, 0x802636],
    ];
    for (const [h, s, v, rgb] of cases) expect(hsv(h, s, v).toString(16), `${h}, ${s}, ${v}`).toBe(rgb.toString(16));
  });
});

describe("intoStage (a burst spawned on the shaking stage)", () => {
  it("lands exactly on the still point given, whatever the shake and the kick's zoom", () => {
    const mouth = { x: 480, y: 600 };
    for (const [dx, dy, scale] of [
      [0, 0, 1],
      [7, -5, 1.05],
      [-12, 9, 1.075],
    ] as const) {
      const stage = { pivot: mouth, position: { x: mouth.x + dx, y: mouth.y + dy }, scale };
      for (const p of [{ x: 120, y: 80 }, { x: 900, y: 300 }, mouth]) {
        const local = intoStage(p, stage);
        // the stage draws its local point at position + (local - pivot) * scale
        const shown = { x: stage.position.x + (local.x - mouth.x) * scale, y: stage.position.y + (local.y - mouth.y) * scale };
        expect(shown.x).toBeCloseTo(p.x, 9);
        expect(shown.y).toBeCloseTo(p.y, 9);
      }
    }
  });
});
