import { Texture, TextureSource } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RARITY_INFO } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import type { Drop, RarityId } from "../../sim/types";
import { BREAKOUT_MAX_WAIT } from "../hd/breakout";
import { GridBoard } from "../pixel/GridBoard";
import { tableLayout } from "../pixel/layout";
import type { SpriteSet } from "../pixel/sprites";
import { pixelViewport } from "../pixel/viewport";
import type { StationDeps } from "./deps";
import { GridStation } from "./GridStation";

// The grid's routing (spec §6): a Covert or ★ that opens breaks out over the table, anything else flashes its cell;
// a new run or the vault drops the ones still waiting; a ★ waits while another knife is in the air.

const tex = (w = 4, h = 4) => new Texture({ source: new TextureSource({ width: w, height: h }) });
const machine: SpriteSet = {
  meta: { id: "auto-buyer", frames: 2, frameW: 57, frameH: 32, ground: 32, eyes: null },
  frames: [tex(57, 32), tex(57, 32)],
  placeholder: true,
};

function setup(knife = { flying: false }) {
  const play = vi.fn();
  const noop = () => {};
  const juice = {
    hd: {
      glowTexture: tex(),
      toScreen: (p: { x: number; y: number }) => ({ x: p.x * 6, y: p.y * 6 }),
      flash: noop,
      particles: { burst: noop },
      coins: { spark: noop },
    },
    audio: { play, duck: noop },
    shake: { add: noop },
    time: { hitStop: noop, slowMo: noop },
    zoom: { punch: noop },
  };
  const d = {
    lib: { get: () => machine },
    skins: { frames: () => [tex()] },
    bake: () => tex(),
    juice,
    scale: () => 6,
    hud: () => ({ x: 0, y: 0 }),
    knifeFlying: () => knife.flying,
  } as unknown as StationDeps;
  const g = new GridStation(d);
  g.layout(tableLayout(pixelViewport(1920, 1080)));
  const s = { grid: { on: true, cells: Array.from({ length: 10 }, () => null) }, tray: [], locker: { items: [] } } as unknown as RunState;
  const opened = vi.spyOn(GridBoard.prototype, "opened");
  const breakouts = () => play.mock.calls.filter((c) => c[0] === "grid-breakout").length;
  return { g, s, opened, breakouts, step: (dt = 1 / 60) => g.update(dt, s) };
}

let n = 1;
const open = (rarity: RarityId, cell = 3): SimEvent => ({
  type: "gridOpened",
  cell,
  drop: { id: n++, caseId: "bootcamp", skinId: "bc_warlord", rarity, float: 0.2, wear: "FT", statTrak: false, value: 1 } satisfies Drop,
});

afterEach(() => vi.restoreAllMocks());

describe("GridStation's routing", () => {
  it("breaks a Covert or ★ out over the table instead of flashing its cell", () => {
    for (const rarity of ["covert", "gold"] as const) {
      const r = setup();
      r.g.onEvent(open(rarity));
      r.step();
      expect(r.opened).not.toHaveBeenCalled();
      expect(r.breakouts()).toBe(1);
      r.g.destroy();
      vi.restoreAllMocks();
    }
  });

  it("flashes the cell of anything else (big for a Classified), with no breakout", () => {
    const r = setup();
    r.g.onEvent(open("milspec", 1));
    r.g.onEvent(open("classified", 2));
    r.step();
    expect(r.opened.mock.calls).toEqual([
      [1, RARITY_INFO.milspec.color, false],
      [2, RARITY_INFO.classified.color, true],
    ]);
    expect(r.breakouts()).toBe(0);
  });

  it.each(["runStarted", "vaultBought"] as const)("drops the breakouts still waiting on %s", (type) => {
    const r = setup();
    r.g.onEvent(open("covert"));
    r.g.onEvent(type === "runStarted" ? { type } : { type, price: 1 });
    for (let i = 0; i < 300; i++) r.step();
    expect(r.breakouts()).toBe(0);
    expect(r.opened).not.toHaveBeenCalled();
  });

  it("holds a ★ while another knife is in the air, and flashes its cell once it has waited too long", () => {
    const knife = { flying: true };
    const r = setup(knife);
    r.g.onEvent(open("gold", 4));
    r.step(BREAKOUT_MAX_WAIT / 2);
    expect(r.breakouts()).toBe(0);
    r.step(BREAKOUT_MAX_WAIT / 2 + 0.01);
    expect(r.breakouts()).toBe(0);
    expect(r.opened.mock.calls).toEqual([[4, RARITY_INFO.gold.color, true]]);
  });

  it("starts the held ★ as soon as the other knife lands", () => {
    const knife = { flying: true };
    const r = setup(knife);
    r.g.onEvent(open("gold"));
    r.step(1);
    expect(r.breakouts()).toBe(0);
    knife.flying = false;
    r.step();
    expect(r.breakouts()).toBe(1);
  });
});
