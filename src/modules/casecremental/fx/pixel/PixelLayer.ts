import { Container, RenderTexture, Sprite, type Renderer } from "pixi.js";
import type { PixelViewport } from "./viewport";

// The pixel world: everything in `world` is drawn in world px into a low-resolution texture, which
// is shown scaled by the integer factor with nearest-neighbour sampling (spec §2). Shake moves the
// view by whole CSS px; nothing in the world is ever scaled or rotated.

export class PixelLayer {
  readonly world = new Container();
  readonly view = new Sprite();
  private rt: RenderTexture | null = null;
  private vp: PixelViewport | null = null;

  resize(vp: PixelViewport): void {
    this.vp = vp;
    this.rt?.destroy(true);
    this.rt = RenderTexture.create({ width: vp.worldW, height: vp.worldH, resolution: 1 });
    this.rt.source.scaleMode = "nearest";
    this.view.texture = this.rt;
    this.view.scale.set(vp.scale);
  }

  render(renderer: Renderer): void {
    if (this.rt) renderer.render({ container: this.world, target: this.rt, clear: true });
  }

  /** Screen shake, rounded to whole CSS px. */
  setOffset(x: number, y: number): void {
    this.view.position.set(Math.round(x), Math.round(y));
  }

  get viewport(): PixelViewport | null {
    return this.vp;
  }

  destroy(): void {
    this.world.destroy({ children: true });
    this.view.destroy();
    this.rt?.destroy(true);
    this.rt = null;
  }
}
