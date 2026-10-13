import { describe, expect, it } from "vitest";
import { anticipate, floatAway, pop, PRESS, pressElement, spring } from "./tween";

const obj = () => ({ scale: { x: 1, y: 1 }, y: 100, alpha: 1 });

describe("tween presets", () => {
  it("pressElement dips and eases back to full size, never past it (a button that grew flashed a scrollbar, F1)", () => {
    const o = { scale: 1 };
    const t = pressElement(o as unknown as Element).pause();
    for (let i = 0; i <= 20; i++) {
      t.progress(i / 20);
      expect(o.scale).toBeLessThanOrEqual(1);
      expect(o.scale).toBeGreaterThanOrEqual(PRESS.from);
    }
    expect(o.scale).toBe(1);
  });
  it("pop grows from small to full size", () => {
    const o = obj();
    const t = pop(o, 0.5).pause();
    t.progress(0);
    expect(o.scale.x).toBe(0.5);
    t.progress(1);
    expect([o.scale.x, o.scale.y]).toEqual([1, 1]);
  });

  it("floatAway rises and fades out", () => {
    const o = obj();
    const t = floatAway(o, 40, 1).pause();
    t.progress(0.5);
    expect(o.alpha).toBe(1);
    t.progress(1);
    expect(o.y).toBe(60);
    expect(o.alpha).toBe(0);
  });

  it("anticipate acts at the peak and settles back to 1", () => {
    const o = obj();
    let acted = 0;
    const t = anticipate(o, () => acted++).pause();
    t.progress(0.1);
    expect(acted).toBe(0);
    t.progress(1);
    expect(acted).toBe(1);
    expect(o.scale.x).toBe(1);
  });

  it("spring returns to rest", () => {
    const o = obj();
    spring(o).pause().progress(1);
    expect(o.scale.x).toBe(1);
  });
});
