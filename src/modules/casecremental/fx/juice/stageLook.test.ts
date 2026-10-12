import { Container, Texture, type Filter } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { HdLayer } from "../hd/HdLayer";
import { GLITCH_SECONDS, STROBE_STRENGTH } from "./stageFive";
import { StageLook, type StageLookFilters } from "./stageLook";

// StageLook's wiring, headless (a real filter needs a GPU context, so the filters are fakes): the strobe goes through
// hd.flash, every glitch burst through takeFlash, and the filters are appended once — after that only `enabled` and
// uniforms change, so the Finale's tear (appended later) stays last.

const DT = 1 / 60;

function fakeFilter<T extends object>(extra: T) {
  return {
    enabled: true,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
    ...extra,
  };
}

function setup(takeFlash: () => boolean) {
  const filters = {
    color: fakeFilter({ reset() {}, saturate() {} }),
    bloom: fakeFilter({ bloomScale: 0 }),
    warp: fakeFilter({ strength: 0, radius: 0 }),
    glitch: fakeFilter({ offset: 0, red: { x: 0, y: 0 }, blue: { x: 0, y: 0 }, seed: 0, refresh() {} }),
  };
  const flashes: Array<[number, number]> = [];
  const asked = { n: 0 };
  const hd = {
    coinFrames: [Texture.EMPTY],
    root: new Container(),
    screen: { w: 800, h: 600 },
    scale: 4,
    flash: (color: number, strength: number) => void flashes.push([color, strength]),
    takeFlash: () => (asked.n++, takeFlash()),
  } as unknown as HdLayer;
  const before = { label: "an earlier filter" } as unknown as Filter;
  const target = {
    sets: 0,
    list: [before] as readonly Filter[],
    get filters(): readonly Filter[] {
      return this.list;
    },
    set filters(v: readonly Filter[]) {
      this.sets++;
      this.list = v;
    },
  };
  const look = new StageLook(target as unknown as Container, hd, filters as unknown as StageLookFilters);
  const drive = (seconds: number, stage = 5, each?: () => void) => {
    look.setStage(stage);
    for (let t = 0; t < seconds; t += DT) {
      look.update(DT, { stage, heat: 10, vault: null });
      each?.();
    }
  };
  return { look, filters, flashes, asked, hd, before, target, drive };
}

describe("StageLook", () => {
  it("appends its filters once, then only toggles them: a tear appended later stays last", () => {
    const s = setup(() => true);
    const f = s.filters;
    expect(s.target.list).toEqual([s.before, f.color, f.bloom, f.warp, f.glitch]);
    const tear = { label: "the Finale's tear" } as unknown as Filter;
    s.target.filters = [...s.target.list, tear]; // what Finale does, constructed after the look
    s.target.sets = 0;
    s.drive(12);
    expect(s.target.sets).toBe(0);
    expect(s.target.list.at(-1)).toBe(tear);
    expect(f.warp.enabled).toBe(true); // stage 5 is in: the warp was switched on in place
  });

  it("strobes through hd.flash at a soft strength, and bursts only when takeFlash grants it", () => {
    const s = setup(() => true);
    let on = 0;
    let longest = 0;
    s.drive(12, 5, () => {
      on = s.filters.glitch.enabled ? on + DT : 0;
      longest = Math.max(longest, on);
    });
    expect(s.flashes.length).toBeGreaterThanOrEqual(4);
    for (const [, strength] of s.flashes) expect(strength).toBe(STROBE_STRENGTH);
    expect(s.asked.n).toBeGreaterThan(0);
    expect(longest).toBeGreaterThan(0);
    expect(longest).toBeLessThanOrEqual(GLITCH_SECONDS + 2 * DT);
  });

  it("holds a burst the flash gate refuses, and shows nothing of stage 5 below it", () => {
    const refused = setup(() => false);
    let ever = false;
    refused.drive(12, 5, () => (ever ||= refused.filters.glitch.enabled));
    expect(refused.asked.n).toBeGreaterThan(0);
    expect(ever).toBe(false);
    const calm = setup(() => true);
    calm.drive(12, 4);
    expect(calm.flashes).toEqual([]);
    expect(calm.asked.n).toBe(0);
    expect(calm.filters.warp.enabled).toBe(false);
  });

  it("destroy takes out its own filters (not the others) and its rain", () => {
    const s = setup(() => true);
    const tear = { label: "the Finale's tear" } as unknown as Filter;
    s.target.filters = [...s.target.list, tear];
    s.drive(3);
    const rain = s.hd.root.children.at(-1) as Container;
    expect(rain.children.length).toBeGreaterThan(0);
    s.look.destroy();
    expect(s.target.list).toEqual([s.before, tear]);
    for (const f of Object.values(s.filters)) expect(f.destroyed).toBe(true);
    expect(s.hd.root.children).not.toContain(rain);
  });
});
