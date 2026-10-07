import { Application, Container, Graphics } from "pixi.js";
import type { GameController } from "../game/controller";
import { computeLayout, type Layout } from "./layout";

// Everything drawn on the canvas. Milestone 1 grows this in three steps: background (Task 13),
// reel + bench (Task 14), juice (Task 16).

export class World {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private layout: Layout;

  constructor(
    private readonly app: Application,
    private readonly controller: GameController,
  ) {
    this.root.addChild(this.bg);
    app.stage.addChild(this.root);
    this.layout = computeLayout(app.screen.width, app.screen.height);
    this.applyLayout();
  }

  timeScale(_realSeconds: number): number {
    return 1;
  }

  update(_realSeconds: number, _scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.layout.width || height !== this.layout.height) {
      this.layout = computeLayout(width, height);
      this.applyLayout();
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private applyLayout(): void {
    const l = this.layout;
    this.bg.clear().rect(0, 0, l.width, l.height).fill({ color: 0x07080c });
    this.bg.rect(l.reel.x, l.reel.y, l.reel.w, l.reel.h).fill({ color: 0x14161f });
  }
}
