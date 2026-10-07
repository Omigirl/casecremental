import { Application, Container, Graphics, type Texture } from "pixi.js";
import type { GameController } from "../game/controller";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { SimEvent } from "../sim/run";
import type { Drop } from "../sim/types";
import { Sfx } from "./audio";
import { BenchView } from "./BenchView";
import { Coins } from "./juice/coins";
import { Particles } from "./juice/particles";
import { Shake } from "./juice/shake";
import { StageLook } from "./juice/stageLook";
import { TimeScale } from "./juice/timeScale";
import { computeLayout, type Layout } from "./layout";
import { ReelView } from "./ReelView";
import { restorePlan } from "./restore";
import { clearSkinTextures } from "./skins/skinTexture";

// Everything drawn on the canvas: background, reel, bench and the juice — sparks, coins, sound,
// screen shake, hit-stop on Covert, slow-mo + zoom on ★, and the look of the intensity stage.

export class World {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly reel: ReelView;
  private readonly bench: BenchView;
  private readonly particles: Particles;
  private readonly coins: Coins;
  private readonly look: StageLook;
  private readonly shake = new Shake();
  private readonly time = new TimeScale();
  private readonly sfx = new Sfx();
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private readonly textures: Texture[];
  private layout: Layout;
  private zoom = 1;
  private zoomTarget = 1;
  private lastStage = 1;
  private readonly off: () => void;
  private readonly unlockAudio = () => this.sfx.unlock();

  constructor(
    private readonly app: Application,
    private readonly controller: GameController,
  ) {
    const dot = app.renderer.generateTexture(new Graphics().circle(0, 0, 6).fill({ color: 0xffffff }));
    const coin = app.renderer.generateTexture(
      new Graphics().circle(0, 0, 8).fill({ color: 0xffd34d }).stroke({ width: 2, color: 0xa87b12 }),
    );
    this.textures = [dot, coin];
    this.reel = new ReelView(() => this.sfx.tick(controller.run.state.combo));
    this.bench = new BenchView(controller);
    this.particles = new Particles(dot);
    this.coins = new Coins(coin);
    this.root.addChild(this.bg, this.reel, this.bench, this.particles.container, this.coins.container);
    this.look = new StageLook(this.root);
    app.stage.addChild(this.root);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", () => {
      if (controller.run.state.bench.phase === "spinning") controller.act({ type: "brake" });
    });
    window.addEventListener("pointerdown", this.unlockAudio);
    this.off = controller.onEvent((e) => this.onEvent(e));
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.layout = computeLayout(app.screen.width, app.screen.height);
    this.applyLayout();
    this.restore();
  }

  /** Redraw a run already in progress (the scene is rebuilt after a trip to the lobby). */
  private restore(): void {
    const plan = restorePlan(this.controller.run.state);
    if (plan.caseId) this.bench.showCase(caseById(plan.caseId));
    if (plan.spinning) this.reel.start(caseById(plan.spinning.caseId), skinById(plan.spinning.skinId), this.rng);
    if (plan.revealed) this.bench.showReveal(skinById(plan.revealed.skinId), plan.revealed);
    this.look.setStage(plan.stage);
    this.lastStage = plan.stage;
  }

  /** Real seconds → this frame's game-time scale (0 during hit-stop, <1 in slow-mo). */
  timeScale(realSeconds: number): number {
    return this.time.update(realSeconds);
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.layout.width || height !== this.layout.height) {
      this.layout = computeLayout(width, height);
      this.applyLayout();
    }
    const game = realSeconds * scale;
    const b = this.controller.run.state.bench;
    this.reel.update(b.phase === "spinning" ? b : null);
    this.bench.update(b, game);
    this.particles.update(game);
    this.coins.update(realSeconds);
    this.look.update(realSeconds);

    if (!this.time.active) this.zoomTarget = 1;
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, realSeconds * 6);
    const s = this.shake.update(realSeconds);
    const cx = this.layout.width / 2;
    const cy = this.layout.bench.y;
    this.root.pivot.set(cx, cy);
    this.root.position.set(cx + s.x, cy + s.y);
    this.root.scale.set(this.zoom);
  }

  destroy(): void {
    this.off();
    window.removeEventListener("pointerdown", this.unlockAudio);
    this.app.stage.removeAllListeners();
    this.root.destroy({ children: true });
    for (const t of this.textures) t.destroy(true);
    clearSkinTextures();
    this.sfx.dispose();
  }

  private applyLayout(): void {
    const l = this.layout;
    this.bg.clear().rect(-l.width, -l.height, l.width * 3, l.height * 3).fill({ color: 0x07080c });
    this.reel.layout(l.reel, l.itemW, l.itemH);
    this.bench.layout(l);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(caseById(e.caseId));
        this.sfx.click();
        break;
      case "spinStarted":
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        this.sfx.click();
        break;
      case "braked":
        this.shake.add(0.12);
        this.sfx.thump(0.35);
        break;
      case "revealed":
        this.onReveal(e.drop);
        break;
      case "sold": {
        const at = this.layout.bench;
        this.coins.burst(at, this.layout.cashTarget, e.amount);
        this.coins.floatText({ x: at.x, y: at.y - 30 }, `+${formatCash(e.amount)}`);
        this.sfx.coin(e.combo);
        this.bench.clearReveal();
        break;
      }
      case "caseUnlocked":
      case "upgradeBought":
        this.sfx.click();
        break;
      case "stageChanged":
        this.look.setStage(e.stage);
        if (e.stage > this.lastStage) {
          this.shake.add(0.3);
          this.sfx.stageUp();
        }
        this.lastStage = e.stage;
        break;
    }
  }

  private onReveal(d: Drop): void {
    this.bench.showReveal(skinById(d.skinId), d);
    const at = this.layout.bench;
    const color = RARITY_INFO[d.rarity].color;
    this.sfx.reveal(RARITY_ORDER.indexOf(d.rarity));
    switch (d.rarity) {
      case "milspec":
        this.particles.burst(at, color, 10, 140);
        break;
      case "restricted":
        this.particles.burst(at, color, 24, 220);
        break;
      case "classified":
        this.particles.burst(at, color, 45, 300);
        this.shake.add(0.2);
        break;
      case "covert":
        this.time.hitStop(0.08);
        this.shake.add(0.55);
        this.sfx.thump(1);
        this.particles.burst(at, color, 90, 420);
        break;
      case "gold":
        this.time.slowMo(0.2, 2.2, 0.7);
        this.zoomTarget = 1.25;
        this.shake.add(0.8);
        this.sfx.jackpot();
        this.particles.burst(at, color, 220, 520);
        break;
    }
  }
}
