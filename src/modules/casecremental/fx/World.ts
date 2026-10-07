import { Application, Container, Graphics } from "pixi.js";
import type { GameController } from "../game/controller";
import { caseById, skinById } from "../sim/content/cases";
import { createRng } from "../sim/rng";
import type { SimEvent } from "../sim/run";
import { BenchView } from "./BenchView";
import { computeLayout, type Layout } from "./layout";
import { ReelView } from "./ReelView";
import { clearSkinTextures } from "./skins/skinTexture";

// Everything drawn on the canvas: background, reel, bench. Juice arrives in Task 16.

export class World {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly reel: ReelView;
  private readonly bench: BenchView;
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private layout: Layout;
  private readonly off: () => void;

  constructor(
    private readonly app: Application,
    private readonly controller: GameController,
  ) {
    this.reel = new ReelView(() => {});
    this.bench = new BenchView(controller);
    this.root.addChild(this.bg, this.reel, this.bench);
    app.stage.addChild(this.root);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", () => {
      if (controller.run.state.bench.phase === "spinning") controller.act({ type: "brake" });
    });
    this.off = controller.onEvent((e) => this.onEvent(e));
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.layout = computeLayout(app.screen.width, app.screen.height);
    this.applyLayout();
  }

  timeScale(_realSeconds: number): number {
    return 1;
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.layout.width || height !== this.layout.height) {
      this.layout = computeLayout(width, height);
      this.applyLayout();
    }
    const b = this.controller.run.state.bench;
    this.reel.update(b.phase === "spinning" ? b : null);
    this.bench.update(b, realSeconds * scale);
  }

  destroy(): void {
    this.off();
    this.app.stage.removeAllListeners();
    this.root.destroy({ children: true });
    clearSkinTextures();
  }

  private applyLayout(): void {
    const l = this.layout;
    this.bg.clear().rect(0, 0, l.width, l.height).fill({ color: 0x07080c });
    this.reel.layout(l.reel, l.itemW, l.itemH);
    this.bench.layout(l);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(caseById(e.caseId));
        break;
      case "spinStarted":
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        break;
      case "revealed":
        this.bench.showReveal(skinById(e.drop.skinId), e.drop);
        break;
      case "sold":
        this.bench.clearReveal();
        break;
      default:
        break;
    }
  }
}
