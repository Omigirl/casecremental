import { Sprite, type Texture } from "pixi.js";
import type { AudioEngine } from "../audio/AudioEngine";
import type { Particles } from "../juice/particles";
import type { Pt } from "../pixel/layout";

// The devil key (rework spec §4): it floats beside the waiting vault, whispering and shedding embers, until the
// player drags it into the lock (or taps it). In the vault scene's screen px.

/** Its 26×38 frame and the drawn key's centre in it. */
export const KEY_FRAME = { w: 26, h: 38, frames: 4 };
const KEY_CENTRE = { x: 10, y: 29.5 };
export const EMBER = 0xff5a1f;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export class DevilKey {
  readonly glow: Sprite;
  readonly sprite: Sprite;
  /** Where it is (screen px). */
  pos: Pt = { x: 0, y: 0 };
  private home: Pt = { x: 0, y: 0 };
  private S = 2;
  private k = 1;
  /** The drag, and the pointer (finger) holding it: no other pointer moves or drops the key. */
  private drag: { id: number; start: Pt; grab: Pt; moved: number } | null = null;
  private emberT = 0;
  private whisperT = 2.5;

  constructor(
    private readonly frames: readonly Texture[],
    soft: Texture,
    private readonly audio: AudioEngine,
    private readonly embers: Particles,
  ) {
    this.glow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0, tint: 0xff2a10 });
    this.sprite = new Sprite({ texture: frames[0], anchor: { x: KEY_CENTRE.x / KEY_FRAME.w, y: KEY_CENTRE.y / KEY_FRAME.h } });
  }

  /** `vaultS`: the waiting vault's scale (the key is drawn a little smaller). */
  layout(home: Pt, vaultS: number, k: number): void {
    this.home = home;
    this.S = Math.max(2, Math.round(vaultS * 0.8));
    this.k = k;
    if (!this.drag) this.pos = { ...home };
  }

  /** The vault is out again: back home, the first whisper a moment away. */
  reset(): void {
    this.pos = { ...this.home };
    this.whisperT = 2.5;
    this.drag = null;
  }

  get dragging(): boolean {
    return !!this.drag;
  }

  /** Pointer `id` went down at `q`: grab the key if it is on it and not already held. */
  grab(q: Pt, id: number): boolean {
    const r = Math.max(28, KEY_FRAME.h * this.S * 0.45);
    if (this.drag || dist(q, this.pos) > r) return false;
    this.drag = { id, start: q, grab: { x: this.pos.x - q.x, y: this.pos.y - q.y }, moved: 0 };
    this.audio.play("key-turn", { gain: 0.4, rate: 0.7 });
    return true;
  }

  /** Pointer `id` moved to `q`: the key follows the finger holding it. */
  move(q: Pt, id: number): void {
    const d = this.drag;
    if (d?.id !== id) return;
    this.pos = { x: q.x + d.grab.x, y: q.y + d.grab.y };
    d.moved = Math.max(d.moved, dist(q, d.start));
  }

  /** Pointer `id` let go: "turn" within `lockR` of the lock (or on a tap), else it floats back. Another
   *  pointer's release changes nothing. */
  release(q: Pt, id: number, lock: Pt, lockR: number): "turn" | "none" {
    const d = this.drag;
    if (d?.id !== id) return "none";
    this.move(q, id);
    this.drag = null;
    return d.moved < 6 || dist(this.pos, lock) <= lockR ? "turn" : "none";
  }

  cancel(): void {
    this.drag = null;
  }

  update(dt: number, clock: number, shown: boolean): void {
    this.sprite.visible = this.glow.visible = shown;
    if (!shown) return;
    this.sprite.texture = this.frames[Math.floor(clock * 6) % this.frames.length]!;
    if (!this.drag) {
      const bob = Math.sin(clock * 2.4) * 4 * Math.max(1, this.k / 6);
      const u = Math.min(1, dt * 8);
      this.pos = { x: lerp(this.pos.x, this.home.x, u), y: lerp(this.pos.y, this.home.y + bob, u) };
    }
    this.sprite.rotation = this.drag ? Math.sin(clock * 20) * 0.08 : 0.12 * Math.sin(clock * 1.7);
    this.sprite.scale.set(this.S * (this.drag ? 1.1 : 1));
    this.sprite.position.set(Math.round(this.pos.x), Math.round(this.pos.y));
    this.glow.position.copyFrom(this.sprite.position);
    this.glow.scale.set((KEY_FRAME.h * this.S * 1.4) / 128);
    this.glow.alpha = 0.55 + 0.3 * Math.sin(clock * 5);
    this.whisperT -= dt;
    if (this.whisperT <= 0) {
      this.whisperT = 6 + Math.random() * 2;
      this.audio.play("devil-key-whisper");
    }
    const v = this.k / 6;
    for (this.emberT += dt; this.emberT >= 0.5; this.emberT -= 0.5)
      this.embers.burst(this.pos, Math.random() < 0.3 ? 0xffb020 : EMBER, 2, 60 * v, -140 * v);
  }
}
