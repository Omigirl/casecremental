import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { EYE_COLOR, eyeRects, VISOR_COLOR, visorPatch } from "./eyes";
import type { Pt } from "./layout";
import type { SpriteMeta, SpriteSet } from "./sprites";
import type { EyeState, Pose } from "./timeline";

// One animated pixel sprite on the table. It shows a drawn frame, nudged by whole pixels: the
// whole sprite (dx/dy) and, for characters, the body and head bands (bodyDy/headDy) — the head band
// is cut one row taller so a 1 px bob never opens a seam (spec §6). Code eyes go on top.

/** Last row of the head band and first row of the legs band, in frame px. */
export interface Bands {
  headEnd: number;
  bodyEnd: number;
}

export interface Part {
  srcY: number;
  h: number;
  dy: number;
}

/** The bands of a frame to draw, back to front, with their vertical offsets. */
export function actorParts(frameH: number, pose: Pick<Pose, "dy" | "bodyDy" | "headDy">, bands?: Bands): Part[] {
  if (!bands) return [{ srcY: 0, h: frameH, dy: pose.dy }];
  const body = pose.dy + pose.bodyDy;
  return [
    { srcY: bands.bodyEnd, h: frameH - bands.bodyEnd, dy: pose.dy },
    { srcY: bands.headEnd, h: bands.bodyEnd - bands.headEnd, dy: body },
    { srcY: 0, h: bands.headEnd + 1, dy: body + pose.headDy },
  ];
}

/** Eye centres in frame px for this pose (they ride the head band and follow the look). */
export function eyePositions(meta: SpriteMeta, pose: Pose): Pt[] {
  const eyes = meta.eyes?.[pose.frame];
  if (!eyes) return [];
  const dy = pose.dy + pose.bodyDy + pose.headDy;
  return eyes.map(([x, y]) => ({ x: x + pose.look, y: y + dy }));
}

export class Actor extends Container {
  private readonly sprites: Sprite[] = [];
  private readonly eyes = new Graphics();
  private readonly cut = new Map<string, Texture>();
  private anchorPt: Pt = { x: 0, y: 0 };
  /** The pose last shown (its frame clamped to the sheet): where its eyes are. */
  private shown: Pose | null = null;

  constructor(
    readonly set: SpriteSet,
    private readonly bands?: Bands,
  ) {
    super();
    const n = bands ? 3 : 1;
    for (let i = 0; i < n; i++) this.sprites.push(this.addChild(new Sprite()));
    this.addChild(this.eyes);
    this.show({ frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open", look: 0 });
  }

  get meta(): SpriteMeta {
    return this.set.meta;
  }

  /** The ground point (feet centre) in world px. */
  place(x: number, y: number): void {
    this.anchorPt = { x: Math.round(x), y: Math.round(y) };
  }

  /** The frame's box in world px for the given pose (hit tests, drag). */
  box(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.meta.frameW, h: this.meta.frameH };
  }

  show(pose: Pose, eyeOverride: EyeState | null = null): void {
    const m = this.meta;
    const frame = Math.min(pose.frame, m.frames - 1);
    this.shown = { ...pose, frame };
    this.position.set(this.anchorPt.x - Math.floor(m.frameW / 2) + pose.dx, this.anchorPt.y - m.ground);
    actorParts(m.frameH, pose, this.bands).forEach((p, i) => {
      const s = this.sprites[i]!;
      s.texture = this.band(frame, p.srcY, p.h);
      s.y = p.srcY + p.dy;
    });
    this.eyes.clear();
    const state = eyeOverride ?? pose.eyes;
    for (const e of eyePositions(m, { ...pose, frame })) {
      const v = visorPatch(e.x, e.y);
      this.eyes.rect(v.x, v.y, v.w, v.h).fill({ color: VISOR_COLOR });
      for (const r of eyeRects(state, e.x, e.y)) this.eyes.rect(r.x, r.y, r.w, r.h).fill({ color: EYE_COLOR });
    }
  }

  /** Eye centres in the parent's px for the pose last shown (none for art without eyes). */
  eyesNow(): Pt[] {
    return this.shown ? eyePositions(this.meta, this.shown).map((e) => ({ x: this.x + e.x, y: this.y + e.y })) : [];
  }

  override destroy(): void {
    for (const t of this.cut.values()) t.destroy(false);
    this.cut.clear();
    super.destroy({ children: true });
  }

  private band(frame: number, srcY: number, h: number): Texture {
    const whole = this.set.frames[frame]!;
    if (!this.bands) return whole;
    const key = `${frame}:${srcY}:${h}`;
    let t = this.cut.get(key);
    if (!t) {
      const f = whole.frame;
      t = new Texture({ source: whole.source, frame: new Rectangle(f.x, f.y + srcY, f.width, h) });
      this.cut.set(key, t);
    }
    return t;
  }
}
