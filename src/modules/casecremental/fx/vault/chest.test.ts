import { describe, expect, it } from "vitest";
import { Texture, TextureSource } from "pixi.js";
import { Chest, chestFrame, snapStretch } from "./chest";
import { VAULT_CUES } from "./cues";
import { vaultCues } from "./cues";
import { vaultLayout } from "./vaultLayout";
import { VAULT_LOOKS, type VaultLook } from "./vaultLooks";

const shut = { lid: 0, seam: 0 };
const { impact } = VAULT_CUES;

describe("the vault's frame", () => {
  it("is closed while the key waits, its seam lit when the key is over the lock", () => {
    expect(chestFrame(null, false, shut)).toBe(0);
    expect(chestFrame(null, true, shut)).toBe(1);
  });

  it("lights its seam once the tremble has widened it a little", () => {
    expect(chestFrame(0.5, false, { lid: 0, seam: 0.1 })).toBe(0);
    expect(chestFrame(0.8, false, { lid: 0, seam: 0.5 })).toBe(1);
  });

  it("shows the in-between frame for a moment after the impact, then stays open", () => {
    expect(chestFrame(impact, false, { lid: 1.1, seam: 0 })).toBe(2);
    expect(chestFrame(impact + 0.04, false, { lid: 1.1, seam: 0 })).toBe(2);
    expect(chestFrame(impact + 0.06, false, { lid: 1, seam: 0 })).toBe(3);
    expect(chestFrame(9, false, { lid: 1, seam: 0 })).toBe(3);
  });
});

describe("the lid's overshoot", () => {
  it("leaves the vault alone until the lid goes past open", () => {
    expect(snapStretch(0)).toEqual({ sx: 1, sy: 1 });
    expect(snapStretch(1)).toEqual({ sx: 1, sy: 1 });
  });

  it("stretches the open frame up while it narrows", () => {
    const s = snapStretch(1.1);
    expect(s.sy).toBeCloseTo(1.25);
    expect(s.sx).toBeCloseTo(0.9);
  });
});

const tex = (w = 68, h = 78) => new Texture({ source: new TextureSource({ width: w, height: h }) });
const sheet = () => [tex(), tex(), tex(), tex()];
const LOOKS: VaultLook[] = Object.values(VAULT_LOOKS);
const OPEN = 9; // the lid long open
const TREMBLING = 2.0; // the intro's run-up: closed, its seam lit

function chestWith(look: VaultLook, frames = sheet()) {
  const chest = new Chest(sheet(), tex(128, 128));
  chest.layout(vaultLayout({ w: 1324, h: 824 }, 4));
  chest.setLook(frames, look.light);
  return chest;
}

describe("the chest's look", () => {
  it("draws the vault's own sheet and lights once its look is set", () => {
    const frames = sheet();
    const look = VAULT_LOOKS.vault2;
    const chest = chestWith(look, frames);
    chest.update(1 / 60, 0, { t: OPEN, cues: vaultCues(OPEN), near: false, beat: 0 });
    expect(chest["sprite"].texture).toBe(frames[3]);
    expect(chest.glow.tint).toBe(look.light.open);
    expect(chest["mouthLight"].tint).toBe(look.light.open);
    chest.update(1 / 60, 0, { t: TREMBLING, cues: vaultCues(TREMBLING), near: false, beat: 0 });
    expect(chest["sprite"].texture).toBe(frames[1]);
    expect(chest.glow.tint).toBe(look.light.tremble);
  });

  it("lights Vault I as before when no look is given", () => {
    const chest = new Chest(sheet(), tex(128, 128));
    chest.layout(vaultLayout({ w: 1324, h: 824 }, 4));
    chest.update(1 / 60, 0, { t: OPEN, cues: vaultCues(OPEN), near: false, beat: 0 });
    expect(chest.glow.tint).toBe(0xffd34d);
    expect(chest["mouthLight"].tint).toBe(0xffd34d);
    chest.update(1 / 60, 0, { t: TREMBLING, cues: vaultCues(TREMBLING), near: false, beat: 0 });
    expect(chest.glow.tint).toBe(0xffb040);
  });

  it("keeps the devil's red around the waiting vault, whatever the vault", () => {
    for (const look of LOOKS) {
      const chest = chestWith(look);
      chest.update(1 / 60, 0, { t: null, cues: vaultCues(-1), near: false, beat: 0 });
      expect(chest.glow.tint, look.id).toBe(0xff2a1a);
    }
  });

  it.each(LOOKS.map((l) => [l.id, l] as const))(
    "%s: the open chest's glow and inner light throb by less than 0.1 on the beat",
    (_, look) => {
      const at = (beat: number) => {
        const chest = chestWith(look);
        chest.update(1 / 60, 0, { t: OPEN, cues: vaultCues(OPEN), near: false, beat });
        return { glow: chest.glow.alpha, mouth: chest["mouthLight"].alpha };
      };
      const still = at(0);
      const hit = at(1);
      expect(Math.abs(hit.glow - still.glow)).toBeLessThan(0.1);
      expect(Math.abs(hit.mouth - still.mouth)).toBeLessThan(0.1);
    },
  );
});
