import { describe, expect, it } from "vitest";
import { EDGE_SPARKS, hsv, intoStage, RAIN, rainCount, rainShow, shimmerTint, sparkCount, sparkSide } from "./chaos";
import { MAX_DENSITY, VAULT_LOOKS } from "./vaultLooks";

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

describe("the chaos per vault", () => {
  const I = VAULT_LOOKS.vault1.chaos;
  const ALL = [VAULT_LOOKS.vault1, VAULT_LOOKS.vault2, VAULT_LOOKS.vault3].map((l) => l.chaos);

  it("rains, sparks and shimmers on Vault I exactly as before", () => {
    expect(rainCount(I)).toBe(96);
    expect(sparkCount(I)).toBe(44);
    for (let i = 0; i < 44; i++) expect(sparkSide(i), `spark ${i}`).toBe(i < 22 ? 1 : -1);
    for (const level of [0, 0.3, 0.75, 1])
      for (let i = 0; i < 96; i++) expect(rainShow(level, 96, i)).toBe(Math.min(1, Math.max(0, level * 96 - i)));
    for (let t = 3.4; t < 17.4; t += 0.13)
      for (const hue of [0, 0.5, 1])
        expect(shimmerTint(t, hue, I.shimmer)).toBe(hsv(0.02 + 0.06 * (0.5 + 0.5 * Math.sin(t * 5.3)), 0.35 * hue, 1));
  });

  it("rains and sparks more on each wilder vault, both edges alike, within the pools", () => {
    for (let n = 1; n < ALL.length; n++) {
      expect(rainCount(ALL[n]!)).toBeGreaterThan(rainCount(ALL[n - 1]!));
      expect(sparkCount(ALL[n]!)).toBeGreaterThan(sparkCount(ALL[n - 1]!));
    }
    for (const c of ALL) {
      expect(rainCount(c)).toBeLessThanOrEqual(RAIN * MAX_DENSITY);
      expect(sparkCount(c)).toBeLessThanOrEqual(2 * EDGE_SPARKS * MAX_DENSITY);
      const sides = Array.from({ length: sparkCount(c) }, (_, i) => sparkSide(i));
      const left = sides.filter((s) => s === 1).length;
      expect(Math.abs(left - (sides.length - left))).toBeLessThanOrEqual(1);
      for (let i = rainCount(c); i < RAIN * MAX_DENSITY; i++) expect(rainShow(1, rainCount(c), i)).toBe(0); // the rest of the pool stays dry
    }
  });

  it("shimmers each vault's beams in hues of its own", () => {
    const at = (look: (typeof ALL)[number]) => shimmerTint(5.1, 1, look.shimmer);
    expect(new Set(ALL.map(at)).size).toBe(3);
    for (const c of ALL) expect(shimmerTint(5.1, 0, c.shimmer)).toBe(0xffffff); // no chaos, no tint
  });
});
