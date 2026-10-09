import { BEAT_LIGHT_AMPLITUDES } from "./beat";
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";
import { VAULT_CUES, type VaultCues } from "./cues";
import { BODY_UP, BODY_W, VAULT_FRAME, type VaultLayout } from "./vaultLayout";

// The vault itself (spec 2026-10-09 §1): slammed into the centre while the key waits; once it turns, it glides
// down to lower centre and settles, trembles in bursts that grow harder while a gold seam of light widens along
// its lid, holds still for a beat, then snaps open — the open frame stretching up past itself while the body
// recoils — and glows gold inside, bouncing on the drop's beat while its inner light throbs. Everything follows
// the sim's t (a reload lands on the same frame); only the waiting vault's breathing and the glows use the wall
// clock.

// frame px inside the 68×78 frame
const MID_X = 34.5;
const LOCK = { x: 35, y: 64 };
const MOUTH_Y = 52;
const SEAM_Y = 59;

const SLAM_SECONDS = 0.35;
/** The key turned: the vault glides from the centre to lower centre, then settles with a bounce. */
const GLIDE_SECONDS = 0.35;
/** Tremble: ~18 Hz, in 0.15 s bursts every 0.25 s. */
const TREMBLE_HZ = 18;
const BURST_EVERY = 0.25;
const BURST_ON = 0.15;
/** After the impact: the in-between frame, and the body's recoil. */
const SNAP_SECONDS = 0.05;
const RECOIL_SECONDS = 0.25;
/** The open chest on a beat: it squashes and hops by this much, and its light inside throbs by this much. */
const BEAT_SQUASH = 0.06;
const BEAT_HOP = 1.5;
const BEAT_THROB = BEAT_LIGHT_AMPLITUDES.mouthLight;
const RED = 0xff2a1a;
const GOLD = 0xffd34d;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export interface ChestView {
  /** Null while the key waits; the opening's sim t once it turned. */
  t: number | null;
  cues: VaultCues;
  /** The key is dragged over the lock. */
  near: boolean;
  /** The drop's beat (0-1, at the chaos's strength): the open chest bounces on it. */
  beat: number;
}

/** The vault's frame: closed; closed with the seam lit (the key over the lock, or the tremble widening it); the
 *  in-between as it snaps open; open. `t` is null while the key waits. */
export function chestFrame(t: number | null, near: boolean, c: Pick<VaultCues, "lid" | "seam">): number {
  if (t === null) return near ? 1 : 0;
  if (c.lid <= 0) return c.seam > 0.15 ? 1 : 0;
  return t - VAULT_CUES.impact < SNAP_SECONDS ? 2 : 3;
}

/** The lid's overshoot past open (lid > 1): the open frame stretches up while it narrows. */
export function snapStretch(lid: number): { sx: number; sy: number } {
  const over = Math.max(0, lid - 1);
  return { sx: 1 - over, sy: 1 + over * 2.5 };
}

export class Chest {
  /** Behind the beams: the light around the vault. */
  readonly glow: Sprite;
  /** In front of the beams and their streams (they pour out of it): the vault, its seam light, the light in
   *  its mouth. */
  readonly front = new Container();
  private readonly sprite: Sprite;
  private readonly seam = new Graphics();
  private readonly mouthLight: Sprite;
  private L: VaultLayout | null = null;
  private slamT: number | null = null;
  private pos: Pt = { x: 0, y: 0 };
  private sx = 1;
  private sy = 1;

  constructor(
    private readonly frames: readonly Texture[],
    soft: Texture,
  ) {
    this.sprite = new Sprite({ texture: frames[0], anchor: { x: MID_X / VAULT_FRAME.w, y: 1 } });
    this.glow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.mouthLight = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0, tint: GOLD });
    this.seam.blendMode = "add";
    this.front.addChild(this.sprite, this.seam, this.mouthLight);
  }

  layout(L: VaultLayout): void {
    this.L = L;
  }

  /** The vault was bought just now: it drops in from above. */
  slam(): void {
    this.slamT = 0;
  }

  /** A reload or the key turned: no slam. */
  clearSlam(): void {
    this.slamT = null;
  }

  /** The vault is still falling (the key hides until it lands). */
  get falling(): boolean {
    return this.slamT !== null && this.slamT < SLAM_SECONDS;
  }

  /** Landed and settled: the key can be grabbed, the hint shows. */
  get settled(): boolean {
    return this.slamT === null;
  }

  /** The lock (screen px). */
  lockPos(): Pt {
    return { x: this.pos.x + (LOCK.x - MID_X) * this.sx, y: this.pos.y + (LOCK.y - VAULT_FRAME.h) * this.sy };
  }

  /** Where the light and the coins come out (screen px). */
  mouth(): Pt {
    return { x: this.pos.x, y: this.pos.y + (MOUTH_Y - VAULT_FRAME.h) * this.sy };
  }

  /** The middle of the lid's seam (screen px). */
  seamPos(): Pt {
    return { x: this.pos.x, y: this.pos.y + (SEAM_Y - VAULT_FRAME.h) * this.sy };
  }

  /** The closed vault's middle (screen px). */
  centre(): Pt {
    return { x: this.pos.x, y: this.pos.y - BODY_UP * this.sy };
  }

  /** The current scale (screen px per sprite px). */
  get scale(): number {
    return this.sx;
  }

  /** Returns true on the frame the slam lands. */
  update(dt: number, clock: number, v: ChestView): boolean {
    const L = this.L;
    if (!L) return false;
    let landed = false;
    let x = L.key.bottom.x;
    let y = L.key.bottom.y;
    let sx = L.key.S;
    let sy = sx;
    const t = v.t;
    if (t === null) {
      if (this.slamT !== null) {
        const before = this.slamT;
        this.slamT += dt;
        const u = this.slamT / SLAM_SECONDS;
        if (u < 1) y -= (1 - u * u) * y;
        else {
          landed = before < SLAM_SECONDS;
          const b = this.slamT - SLAM_SECONDS;
          const squash = Math.exp(-b * 9) * Math.sin(b * 34) * 0.14;
          sx *= 1 + squash;
          sy *= 1 - squash;
          if (b > 0.6) this.slamT = null;
        }
      } else {
        const breathe = 1 + 0.02 * Math.sin(clock * 2.2);
        sx *= breathe;
        sy *= breathe;
      }
    } else {
      // the glide down, arriving with a settle bounce
      const g = easeOut(t / GLIDE_SECONDS);
      x = lerp(x, L.chest.x, g);
      y = lerp(y, L.chest.bottom, g);
      const b = t - GLIDE_SECONDS;
      const settle = b > 0 ? 1 + 0.1 * Math.exp(-b * 8) * Math.sin(b * 26) : 1;
      sx = lerp(sx, L.chest.S, g) * settle;
      sy = sx;
      // tremble in bursts
      const c = v.cues;
      if (c.tremble > 0 && t % BURST_EVERY < BURST_ON) {
        const a = c.tremble * 2 * L.chest.S;
        x += Math.round(a * Math.sin(2 * Math.PI * TREMBLE_HZ * t));
        y += Math.round(a * 0.4 * Math.cos(2 * Math.PI * TREMBLE_HZ * 1.3 * t));
      }
      // the snap: the open frame stretches up past itself, the body recoils down 2 px, then both settle
      const snap = snapStretch(c.lid);
      sy *= snap.sy;
      sx *= snap.sx;
      const since = t - VAULT_CUES.impact;
      if (since >= 0 && since < RECOIL_SECONDS) y += 2 * L.chest.S * (1 - since / RECOIL_SECONDS) ** 2;
      // the bounce on the beat: a squash and a little hop
      if (c.lid > 0 && v.beat > 0) {
        sy *= 1 - BEAT_SQUASH * v.beat;
        sx *= 1 + BEAT_SQUASH * v.beat;
        y -= BEAT_HOP * L.chest.S * v.beat;
      }
    }
    this.pos = { x: Math.round(x), y: Math.round(y) };
    this.sx = sx;
    this.sy = sy;
    this.sprite.position.set(this.pos.x, this.pos.y);
    this.sprite.scale.set(sx, sy);
    this.sprite.texture = this.frames[chestFrame(t, v.near, v.cues)]!;
    this.light(clock, t, v);
    return landed;
  }

  /** Red around the waiting vault; orange and the seam while it trembles; gold once it is open. */
  private light(clock: number, t: number | null, v: ChestView): void {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 3.1);
    const c = this.centre();
    const open = t !== null && v.cues.lid > 0;
    this.glow.position.set(c.x, open ? this.mouth().y : c.y);
    this.glow.scale.set((BODY_W * this.sx * (open ? 3.2 : 2.6)) / 128);
    if (t === null) {
      this.glow.tint = RED;
      this.glow.alpha = (v.near ? 0.75 : 0.35) + 0.25 * pulse;
    } else if (!open) {
      this.glow.tint = 0xffb040;
      this.glow.alpha = 0.3 + 0.5 * v.cues.seam + 0.1 * pulse;
    } else {
      this.glow.tint = GOLD;
      this.glow.alpha = Math.min(1, 0.7 + 0.15 * pulse + BEAT_LIGHT_AMPLITUDES.chestGlow * v.beat);
    }
    // the seam: a gold line over the lid's seam, wider and brighter as the tremble builds
    const seam = t !== null && !open ? v.cues.seam : 0;
    this.seam.clear();
    if (seam > 0) {
      const sw = BODY_W * this.sx * (0.5 + 0.5 * seam);
      const th = Math.max(2, Math.round(this.sx * (0.5 + 2 * seam)));
      const sy = this.pos.y + (SEAM_Y - VAULT_FRAME.h) * this.sy;
      this.seam.rect(Math.round(this.pos.x - sw / 2), Math.round(sy - th / 2), Math.round(sw), th).fill({ color: GOLD });
      this.seam.alpha = 0.55 + 0.45 * Math.abs(Math.sin(clock * 23));
    }
    // the gentle gold light inside while it is open
    const m = this.mouth();
    this.mouthLight.visible = open;
    this.mouthLight.position.set(m.x, m.y);
    this.mouthLight.scale.set((BODY_W * this.sx * 1.1) / 128, (BODY_W * this.sx * 0.5) / 128);
    this.mouthLight.alpha = Math.min(1, 0.45 + 0.2 * pulse + BEAT_THROB * v.beat);
  }
}
