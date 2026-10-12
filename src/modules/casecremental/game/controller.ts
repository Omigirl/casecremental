import type { CharmId } from "../sim/charms";
import { buyPerk, completeVault, freshMeta, pickCharm, setupFor, type MetaState, type PerkId } from "../sim/meta";
import { Run, type ActionResult, type CardSpot, type SimEvent } from "../sim/run";
import type { RarityId } from "../sim/types";
import type { UpgradeId } from "../sim/upgrades";
import { SAVE_VERSION, type SaveSlot } from "./save";
import { buildView, type GameView } from "./view";

// Owns the campaign: the prestige meta and the current run. The scene calls step() every frame; the
// player, the React panel and the agent all change the game through act() — the one input path. After a
// vault the meta is paid once; startNextRun swaps in a fresh run built from the meta. Everything is saved
// to the slot about once a second and after every successful action.

export type Action =
  | { type: "buyCase"; caseId: string }
  | { type: "insertKey" }
  | { type: "sell"; slot?: number }
  | { type: "unlockCase"; caseId: string }
  | { type: "buyUpgrade"; id: UpgradeId }
  | { type: "claim"; index: number }
  | { type: "wakeBot" }
  | { type: "buyBotSpeed" }
  | { type: "buyBotMulti" }
  | { type: "sellBot"; slot?: number }
  | { type: "setBotCase"; caseId: string | null }
  | { type: "buySeller" }
  | { type: "buySellerSpeed" }
  | { type: "setSellerThreshold"; rarity: RarityId }
  | { type: "holdCard"; spot: CardSpot | null; slot?: number }
  | { type: "buyLocker" }
  | { type: "buyLockerSize" }
  | { type: "setCollect"; rarity: RarityId | null }
  | { type: "storeCard"; from: CardSpot | "tray"; slot: number }
  | { type: "tradeUp" }
  | { type: "sellLocker"; slot?: number }
  | { type: "buyAutoContract" }
  | { type: "buyAutoSpin" }
  | { type: "buyAutoSpinDelay" }
  | { type: "setAutoSpin"; on: boolean }
  | { type: "setAutoSpinCase"; caseId: string }
  | { type: "startDayJob" }
  | { type: "buyVault" }
  | { type: "turnVaultKey" }
  | { type: "buyPerk"; id: PerkId }
  | { type: "pickCharm"; id: CharmId }
  | { type: "startNextRun" };

export const SIM_STEP = 1 / 30;
/** A frame longer than this (tab was hidden, debugger pause) is clamped. */
export const MAX_FRAME_SECONDS = 0.25;
const VIEW_REFRESH_SECONDS = 0.1;
const AUTOSAVE_SECONDS = 1;

export class GameController {
  readonly meta: MetaState;
  /** Set each frame by the scene: 0 = hit-stop, <1 = slow-mo. */
  timeScale = 1;
  mounted = false;
  running = false;

  private current: Run;
  private acc = 0;
  private viewAge = 0;
  private saveAge = 0;
  private view: GameView;
  private readonly eventListeners = new Set<(e: SimEvent) => void>();
  private readonly viewListeners = new Set<() => void>();

  constructor(
    seed: number = Date.now() >>> 0,
    private readonly slot: SaveSlot | null = null,
  ) {
    const restored = GameController.restore(slot);
    this.meta = restored?.meta ?? freshMeta();
    this.current = restored?.run ?? new Run(seed);
    this.view = buildView(this.current, this.meta);
  }

  /** The saved campaign, or null — a save that loads but cannot run starts fresh (M2b spec §9). */
  private static restore(slot: SaveSlot | null): { meta: MetaState; run: Run } | null {
    const saved = slot?.load() ?? null;
    if (!saved) return null;
    try {
      const run = Run.fromSnapshot(saved.run);
      buildView(run, saved.meta); // reads every case, price and upgrade the run refers to
      return { meta: saved.meta, run };
    } catch (err) {
      console.warn("[casecremental] the saved game could not be restored — starting fresh", err);
      return null;
    }
  }

  get run(): Run {
    return this.current;
  }

  step(realSeconds: number): void {
    const frame = Math.min(Math.max(realSeconds, 0), MAX_FRAME_SECONDS);
    this.acc += frame * this.timeScale;
    while (this.acc >= SIM_STEP) {
      this.current.tick(SIM_STEP);
      this.acc -= SIM_STEP;
    }
    this.flush();
    this.viewAge += frame;
    if (this.viewAge >= VIEW_REFRESH_SECONDS) {
      this.viewAge = 0;
      this.refreshView();
    }
    this.saveAge += frame;
    if (this.saveAge >= AUTOSAVE_SECONDS) {
      this.saveAge = 0;
      this.save();
    }
  }

  act(action: Action): ActionResult {
    const r = this.dispatch(action);
    this.flush();
    if (r.ok) this.save();
    this.refreshView();
    return r;
  }

  /** Dev: forget the save and start a fresh campaign. */
  resetProgress(seed: number = Date.now() >>> 0): void {
    this.slot?.clear();
    Object.assign(this.meta, freshMeta());
    this.current = new Run(seed);
    this.emit({ type: "runStarted" });
    this.refreshView();
  }

  /** Dev: jump to a run (1-4) with the meta kept (CLOUT, perks, trophies); offer and picks are cleared. */
  devStartRun(run: number): void {
    this.meta.loops = Math.max(0, Math.floor(run) - 1);
    this.meta.offer = null;
    this.meta.picked = [];
    this.current = new Run((this.current.seed + 1) >>> 0, setupFor(this.meta));
    this.emit({ type: "runStarted" });
    this.save();
    this.refreshView();
  }

  /** Dev: add cash (not lifetime earnings). */
  devAddCash(amount: number): void {
    this.current.state.cash += amount;
    this.save();
    this.refreshView();
  }

  /** Save now (the page is closing): autosave runs only about once a second. */
  saveNow(): void {
    this.save();
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
    const run = this.current;
    switch (a.type) {
      case "buyCase":
        return run.buyCase(a.caseId);
      case "insertKey":
        return run.insertKey();
      case "sell":
        return run.sell(a.slot ?? 0);
      case "unlockCase":
        return run.unlockCase(a.caseId);
      case "buyUpgrade":
        return run.buyUpgrade(a.id);
      case "claim":
        return run.claim(a.index);
      case "wakeBot":
        return run.wakeBot();
      case "buyBotSpeed":
        return run.buyBotSpeed();
      case "buyBotMulti":
        return run.buyBotMulti();
      case "sellBot":
        return run.sellBotCard(a.slot ?? 0);
      case "setBotCase":
        return run.setBotCase(a.caseId);
      case "buySeller":
        return run.buySeller();
      case "buySellerSpeed":
        return run.buySellerSpeed();
      case "setSellerThreshold":
        return run.setSellerThreshold(a.rarity);
      case "holdCard":
        return run.setHeld(a.spot, a.slot ?? 0);
      case "buyLocker":
        return run.buyLocker();
      case "buyLockerSize":
        return run.buyLockerSize();
      case "setCollect":
        return run.setCollect(a.rarity);
      case "storeCard":
        return run.storeCard(a.from, a.slot);
      case "tradeUp":
        return run.tradeUp();
      case "sellLocker":
        return run.sellLockerCard(a.slot);
      case "buyAutoContract":
        return run.buyAutoContract();
      case "buyAutoSpin":
        return run.buyAutoSpin();
      case "buyAutoSpinDelay":
        return run.buyAutoSpinDelay();
      case "setAutoSpin":
        return run.setAutoSpin(a.on);
      case "setAutoSpinCase":
        return run.setAutoSpinCase(a.caseId);
      case "startDayJob":
        return run.startDayJob();
      case "buyVault":
        return run.buyVault();
      case "turnVaultKey":
        return run.turnVaultKey();
      case "buyPerk":
        if (!run.state.over) return { ok: false, reason: "perks are bought between runs" };
        return this.emitOnOk(buyPerk(this.meta, a.id), { type: "perkBought" });
      case "pickCharm":
        return this.pickCharm(a.id);
      case "startNextRun":
        return this.startNextRun();
    }
  }

  /** The charm toggles; only a pick (not an un-pick) makes the pick sound. */
  private pickCharm(id: CharmId): ActionResult {
    const r = pickCharm(this.meta, id);
    if (r.ok && this.meta.picked.includes(id)) this.emit({ type: "charmPicked" });
    return r;
  }

  private startNextRun(): ActionResult {
    if (!this.current.state.over) return { ok: false, reason: "the run is still going" };
    const seed = (this.current.seed + Math.imul(this.meta.loops, 0x9e3779b1)) >>> 0;
    this.current = new Run(seed, setupFor(this.meta));
    this.meta.offer = null;
    this.meta.picked = [];
    this.emit({ type: "runStarted" });
    return { ok: true };
  }

  private flush(): void {
    for (const e of this.current.drainEvents()) {
      if (e.type === "vaultOpened") {
        completeVault(this.meta, e.lifetimeEarnings, e.trophy, this.current.seed);
        this.save();
      }
      this.emit(e);
    }
  }

  private emitOnOk(r: ActionResult, e: SimEvent): ActionResult {
    if (r.ok) this.emit(e);
    return r;
  }

  private emit(e: SimEvent): void {
    for (const l of this.eventListeners) l(e);
  }

  private save(): void {
    this.slot?.save({ v: SAVE_VERSION, meta: this.meta, run: this.current.snapshot() });
  }

  private refreshView(): void {
    this.view = buildView(this.current, this.meta);
    for (const l of this.viewListeners) l();
  }
}
