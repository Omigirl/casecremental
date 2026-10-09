import { Container, Texture, TextureSource } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { skinName } from "../../i18n/content";
import { CASES } from "../../sim/content/cases";
import { createRng } from "../../sim/rng";
import { VAULT_LAND_TIMES } from "../../sim/tuning";
import type { Drop } from "../../sim/types";
import type { Juice } from "../juice/juice";
import { pixelViewport } from "../pixel/viewport";
import type { SkinTextures } from "../skins/pixelSkin";
import { VAULT_CUES, vaultCues, type VaultCues } from "./cues";
import { VaultBeams } from "./VaultBeams";
import { vaultLayout } from "./vaultLayout";
import type { VaultScene } from "./VaultScene";

/** Mid-spin: two seconds after the impact, every beam grown in. */
const SPINNING = VAULT_CUES.impact + 2;

// Pixi's gradient fill needs a canvas: plain styles here (the text's look isn't under test)
vi.mock("../hd/font", () => ({
  moneyStyle: (fontSize: number) => ({ fontSize }),
  pixelStyle: (fontSize: number, fill: number) => ({ fontSize, fill }),
}));

const tex = (w = 16, h = 16) => new Texture({ source: new TextureSource({ width: w, height: h }) });

function harness(screen = { w: 1324, h: 824 }) {
  const frames = [tex(26, 10)];
  const skins = { frames: () => frames, fps: () => 8 } as unknown as SkinTextures;
  const stage = new Container();
  const beamSlot = new Container();
  stage.addChild(beamSlot);
  const streamSlot = new Container();
  const labelSlot = new Container();
  // as in the scene: the beams on the chaos stage (their camera), the stream and the labels beside it
  const root = new Container({ children: [stage, streamSlot, labelSlot] });
  const firework = vi.fn();
  const scene = { beamSlot, streamSlot, labelSlot, art: { soft: tex(), coins: [tex(), tex()] }, firework } as unknown as VaultScene;
  const play = vi.fn();
  const juice = { audio: { play }, shake: { add: vi.fn() } } as unknown as Juice;
  const beams = new VaultBeams(skins, scene, juice, createRng(7));
  const vp = pixelViewport(screen.w, screen.h);
  const L = vaultLayout(screen, vp.scale);
  beams.layout(L, vp.scale);
  return { beams, root, stage, beamSlot, streamSlot, labelSlot, L, play, firework };
}

const top = CASES[CASES.length - 1]!.skins;
const drops: Drop[] = top.slice(0, 5).map((s, i) => ({
  id: i + 1,
  caseId: "vault1",
  skinId: s.id,
  rarity: s.rarity,
  float: 0.1,
  wear: "MW",
  statTrak: false,
  value: 1000 * (i + 1),
}));

/** The beams' private lanes, read for the test. */
const lanesOf = (b: VaultBeams) => b["lanes"];

describe("VaultBeams' lock-ins", () => {
  it("plays a lock-in's flash from its landing time, even when it lands before the first frame after the start", () => {
    for (const how of ["start", "restore"] as const) {
      const h = harness();
      if (how === "start") h.beams.start(drops);
      else h.beams.restore(drops, 0);
      h.beams.landed(0, drops[0]!, 1000); // no update since the key turn: the beams' clock still reads 0
      h.beams.update(VAULT_LAND_TIMES[0] + 0.05);
      const lane = lanesOf(h.beams)[0]!;
      expect(lane.flash.alpha, how).toBeGreaterThan(0.5);
      expect(lane.reward.scale.x, how).toBeGreaterThan(1); // the pop is playing
    }
  });
});

describe("VaultBeams' stream under the camera", () => {
  /** The kick's punch and shake on the beams' camera (the chaos stage), and the bob on the stream's slot. */
  function kick(h: ReturnType<typeof harness>) {
    const mouth = h.L.beams[0]!.origin;
    h.stage.pivot.set(mouth.x, mouth.y);
    h.stage.position.set(mouth.x + 9, mouth.y - 6);
    h.stage.scale.set(1.05);
    h.streamSlot.y = -3;
  }
  /** Runs the frame's render-time hooks (Pixi calls them before it draws). */
  const render = (h: ReturnType<typeof harness>) => {
    for (const c of h.streamSlot.children) c.onRender?.(undefined as never);
  };
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it("keeps the streamed items on their beams through the shake and the zoom", () => {
    const h = harness();
    h.beams.start(drops);
    h.beams.update(SPINNING);
    kick(h);
    render(h);
    const lane = lanesOf(h.beams)[2]!; // the centre beam: its items sit on its axis, give or take the scatter
    const shown = lane.pool.filter((s) => s.visible);
    expect(shown.length).toBeGreaterThan(0);
    for (const s of shown) {
      const c = { x: s.x + (s.texture.width * s.scale.x) / 2, y: s.y + (s.texture.height * s.scale.y) / 2 };
      // where the beams' camera draws that point, and where the stream's layer draws it now
      const onBeam = h.root.toLocal(c, h.beamSlot);
      const drawn = h.root.toLocal(c, s.parent!);
      expect(near(onBeam, drawn)).toBeLessThan(1e-6);
    }
  });

  it("lets a landed reward settle off the camera, readable by its label", () => {
    const h = harness();
    h.beams.start(drops);
    h.beams.landed(0, drops[0]!, 1000);
    const t = VAULT_LAND_TIMES[0] + 1;
    h.beams.update(t);
    kick(h);
    render(h);
    const lane = lanesOf(h.beams)[0]!;
    expect(lane.reward.visible).toBe(true);
    // only the slot's bob moves it: the camera's shake and punch don't
    const drawn = h.root.toLocal(lane.reward.position, lane.reward.parent!);
    expect(near(drawn, { x: lane.reward.x, y: lane.reward.y - 3 })).toBeLessThan(1e-6);
  });

  it("carries a reward still spinning with its beam", () => {
    const h = harness();
    h.beams.start(drops);
    h.beams.update(VAULT_LAND_TIMES[4] - 0.3);
    kick(h);
    render(h);
    const r = lanesOf(h.beams)[4]!.reward;
    expect(r.visible).toBe(true);
    expect(near(h.root.toLocal(r.position, h.beamSlot), h.root.toLocal(r.position, r.parent!))).toBeLessThan(1e-6);
  });
});

describe("VaultBeams' labels", () => {
  it("fits the +$ line to its box and truncates a name that can't fit at the floor", () => {
    const h = harness();
    const box = h.L.beams[0]!.label;
    box.w = 3 * box.h; // far narrower than any layout gives: 6 characters a line at the base size
    h.beams.layout(h.L, pixelViewport(1324, 824).scale);
    // lane 0 lands the top case's longest name
    const long = [...top].sort((a, b) => skinName(b.id).length - skinName(a.id).length)[0]!;
    const rich = drops.map((d, i) => (i ? d : { ...d, skinId: long.id, rarity: long.rarity }));
    h.beams.start(rich);
    h.beams.landed(0, rich[0]!, 999.4e15);
    h.beams.update(VAULT_LAND_TIMES[0] + 1);
    const lane = lanesOf(h.beams)[0]!;
    const base = box.h / 2;
    const width = (t: { text: string; style: { fontSize: number } }) => [...t.text].length * t.style.fontSize;
    expect(lane.label.money.text.startsWith("+"), lane.label.money.text).toBe(true);
    expect([...lane.label.money.text].length * base, lane.label.money.text).toBeGreaterThan(box.w); // too wide at the base size
    expect(lane.label.money.style.fontSize).toBeLessThan(base);
    expect(width(lane.label.money)).toBeLessThanOrEqual(box.w);
    expect(width(lane.label.name)).toBeLessThanOrEqual(box.w);
    expect(lane.label.name.text, skinName(long.id)).toMatch(/…$/);
    expect(skinName(long.id).startsWith(lane.label.name.text.slice(0, -1))).toBe(true);
  });

  it("backs the label with its plaque, headroom under the +$ included", () => {
    const h = harness();
    h.beams.start(drops);
    h.beams.landed(0, drops[0]!, 1000);
    h.beams.update(VAULT_LAND_TIMES[0] + 1);
    const lane = lanesOf(h.beams)[0]!;
    const plaque = h.L.beams[0]!.plaque;
    const b = lane.label.back.getLocalBounds();
    expect(Math.round(b.height)).toBe(Math.round(plaque.h));
    expect(Math.round(b.y)).toBe(Math.round(plaque.y));
  });
});

describe("VaultBeams.update's cues", () => {
  it("uses the frame's cues when given, else works them out from t", () => {
    const h = harness();
    h.beams.start(drops);
    h.beams.update(SPINNING);
    expect(lanesOf(h.beams)[0]!.beam.visible).toBe(true); // grown in by then
    const none = { ...vaultCues(SPINNING), columnIn: [0, 0, 0, 0, 0] as VaultCues["columnIn"] };
    h.beams.update(SPINNING, none);
    expect(lanesOf(h.beams)[0]!.beam.visible).toBe(false);
  });
});
