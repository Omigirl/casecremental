import { describe, expect, it } from "vitest";
import { anticipate, floatAway, pop, spring } from "./tween";

const obj = () => ({ scale: { x: 1, y: 1 }, y: 100, alpha: 1 });

describe("tween presets", () => {
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
