import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { AudioEngine } from "../audio/AudioEngine";
import { Particles } from "../juice/particles";
import { DevilKey } from "./devilKey";

const tex = () => new Texture({ source: new TextureSource({ width: 1, height: 1 }) });
const quiet = { play: () => {} } as unknown as AudioEngine;

/** A key at home (100, 100), the lock at (400, 100) taking anything within 20 px. */
function rig() {
  const key = new DevilKey([tex(), tex()], tex(), quiet, new Particles(tex()));
  key.layout({ x: 100, y: 100 }, 4, 6);
  const lock = { x: 400, y: 100 };
  return { key, release: (q: { x: number; y: number }, id: number) => key.release(q, id, lock, 20) };
}

describe("the devil key's drag (multi-touch)", () => {
  it("follows the finger that grabbed it and turns in the lock", () => {
    const { key, release } = rig();
    expect(key.grab({ x: 100, y: 100 }, 1)).toBe(true);
    key.move({ x: 250, y: 100 }, 1);
    expect(key.pos.x).toBe(250);
    expect(release({ x: 400, y: 100 }, 1)).toBe("turn");
    expect(key.dragging).toBe(false);
  });

  it("ignores another finger: it can't move the key, drop it or turn it", () => {
    const { key, release } = rig();
    key.grab({ x: 100, y: 100 }, 1);
    key.move({ x: 160, y: 100 }, 1);
    key.move({ x: 400, y: 100 }, 2);
    expect(key.pos.x).toBe(160);
    expect(release({ x: 400, y: 100 }, 2)).toBe("none");
    expect(key.dragging).toBe(true); // still in the first finger's hand
    expect(key.pos.x).toBe(160);
    expect(release({ x: 160, y: 100 }, 1)).toBe("none"); // dropped short of the lock: it floats back
    expect(key.dragging).toBe(false);
  });

  it("can't be grabbed a second time while held", () => {
    const { key } = rig();
    key.grab({ x: 100, y: 100 }, 1);
    expect(key.grab({ x: 100, y: 100 }, 2)).toBe(false);
    key.move({ x: 130, y: 100 }, 1);
    expect(key.pos.x).toBe(130);
  });

  it("a cancelled touch (the OS took the finger) frees the key for another finger", () => {
    const { key, release } = rig();
    key.grab({ x: 100, y: 100 }, 1);
    key.move({ x: 160, y: 100 }, 1);
    key.cancel(1); // no pointerup will ever come for finger 1
    expect(key.dragging).toBe(false);
    expect(key.grab({ x: 160, y: 100 }, 2)).toBe(true);
    key.move({ x: 400, y: 100 }, 2);
    expect(release({ x: 400, y: 100 }, 2)).toBe("turn");
  });

  it("another finger's cancel leaves the key in the hand holding it", () => {
    const { key } = rig();
    key.grab({ x: 100, y: 100 }, 1);
    key.cancel(2);
    expect(key.dragging).toBe(true);
    key.move({ x: 130, y: 100 }, 1);
    expect(key.pos.x).toBe(130);
  });
});
