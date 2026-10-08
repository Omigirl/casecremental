import { Assets, Rectangle, Texture } from "pixi.js";

// Built sprites (assets/sprites/<id>.png + .json, made by `npm run art`) as Pixi textures with
// nearest-neighbour sampling. A sprite whose art isn't built yet gets a magenta placeholder of the
// expected size, so the game always starts (Review Focus 1).

export interface SpriteMeta {
  id: string;
  frames: number;
  frameW: number;
  frameH: number;
  ground: number;
  eyes: ([number, number][] | null)[] | null;
}

export interface SpriteSet {
  meta: SpriteMeta;
  frames: Texture[];
  placeholder: boolean;
}

const METAS = import.meta.glob("../../assets/sprites/*.json", { eager: true, import: "default" }) as Record<string, SpriteMeta>;
const URLS = import.meta.glob("../../assets/sprites/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export function spriteIndex(): Map<string, { meta: SpriteMeta; url: string }> {
  const out = new Map<string, { meta: SpriteMeta; url: string }>();
  for (const [path, meta] of Object.entries(METAS)) {
    const url = URLS[path.replace(/\.json$/, ".png")];
    if (url) out.set(meta.id, { meta, url });
  }
  return out;
}

export const placeholderMeta = (id: string, w: number, h: number, frames = 1): SpriteMeta => ({
  id,
  frames,
  frameW: w,
  frameH: h,
  ground: h - 1,
  eyes: null,
});

function placeholderTexture(w: number, h: number): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      g.fillStyle = (x + y) % 2 ? "#ff00ff" : "#2a002a";
      g.fillRect(x, y, 1, 1);
    }
  const t = Texture.from(c);
  t.source.scaleMode = "nearest";
  return t;
}

export class SpriteLibrary {
  private constructor(
    private readonly sets: Map<string, SpriteSet>,
    private readonly owned: Texture[],
  ) {}

  static async load(): Promise<SpriteLibrary> {
    const sets = new Map<string, SpriteSet>();
    for (const [id, { meta, url }] of spriteIndex()) {
      const base: Texture = await Assets.load(url);
      base.source.scaleMode = "nearest";
      const frames = Array.from(
        { length: meta.frames },
        (_, i) => new Texture({ source: base.source, frame: new Rectangle(i * meta.frameW, 0, meta.frameW, meta.frameH) }),
      );
      sets.set(id, { meta, frames, placeholder: false });
    }
    return new SpriteLibrary(sets, []);
  }

  has(id: string): boolean {
    return this.sets.has(id) && !this.sets.get(id)!.placeholder;
  }

  get(id: string, fallback: { w: number; h: number; frames?: number }): SpriteSet {
    const found = this.sets.get(id);
    if (found) return found;
    const meta = placeholderMeta(id, fallback.w, fallback.h, fallback.frames ?? 1);
    const tex = placeholderTexture(fallback.w, fallback.h);
    this.owned.push(tex);
    const set: SpriteSet = { meta, frames: Array.from({ length: meta.frames }, () => tex), placeholder: true };
    this.sets.set(id, set);
    console.warn(`[casecremental] sprite "${id}" not built — using a placeholder`);
    return set;
  }

  destroy(): void {
    for (const t of this.owned) t.destroy(true);
    this.owned.length = 0;
  }
}
