import { Run, type ActionResult, type SimEvent } from "../sim/run";
import type { UpgradeId } from "../sim/upgrades";
import { buildView, type GameView } from "./view";

// Owns the run. The scene calls step() every frame; the player, the React panel and the agent all
// change the game through act() — the one input path.

export type Action =
  | { type: "buyCase"; caseId: string }
  | { type: "insertKey" }
  | { type: "brake" }
  | { type: "sell" }
  | { type: "unlockCase"; caseId: string }
  | { type: "buyUpgrade"; id: UpgradeId };

export const SIM_STEP = 1 / 30;
/** A frame longer than this (tab was hidden, debugger pause) is clamped. */
export const MAX_FRAME_SECONDS = 0.25;
const VIEW_REFRESH_SECONDS = 0.1;

export class GameController {
  readonly run: Run;
  /** Set each frame by the scene: 0 = hit-stop, <1 = slow-mo. */
  timeScale = 1;
  mounted = false;
  running = false;

  private acc = 0;
  private viewAge = 0;
  private view: GameView;
  private readonly eventListeners = new Set<(e: SimEvent) => void>();
  private readonly viewListeners = new Set<() => void>();

  constructor(seed: number = Date.now() >>> 0) {
    this.run = new Run(seed);
    this.view = buildView(this.run);
  }

  step(realSeconds: number): void {
    const frame = Math.min(Math.max(realSeconds, 0), MAX_FRAME_SECONDS);
    this.acc += frame * this.timeScale;
    while (this.acc >= SIM_STEP) {
      this.run.tick(SIM_STEP);
      this.acc -= SIM_STEP;
    }
    this.flush();
    this.viewAge += frame;
    if (this.viewAge >= VIEW_REFRESH_SECONDS) {
      this.viewAge = 0;
      this.refreshView();
    }
  }

  act(action: Action): ActionResult {
    const r = this.dispatch(action);
    this.flush();
    this.refreshView();
    return r;
  }

  onEvent(listener: (e: SimEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  };

  readonly getView = (): GameView => this.view;

  private dispatch(a: Action): ActionResult {
    switch (a.type) {
      case "buyCase":
        return this.run.buyCase(a.caseId);
      case "insertKey":
        return this.run.insertKey();
      case "brake":
        return this.run.brake();
      case "sell":
        return this.run.sell();
      case "unlockCase":
        return this.run.unlockCase(a.caseId);
      case "buyUpgrade":
        return this.run.buyUpgrade(a.id);
    }
  }

  private flush(): void {
    for (const e of this.run.drainEvents()) for (const l of this.eventListeners) l(e);
  }

  private refreshView(): void {
    this.view = buildView(this.run);
    for (const l of this.viewListeners) l();
  }
}
