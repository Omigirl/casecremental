import { Container } from "pixi.js";
import type { RunState, SimEvent } from "../../sim/run";
import type { LiftInfo } from "../hd/Lifted";
import type { Pt, TableLayout } from "../pixel/layout";
import type { RestorePlan } from "../restore";
import { BotStation } from "./BotStation";
import type { StationDeps } from "./deps";

// The stations beside your bench (M3: the bot's pair, the locker, the auto-buyer grid): drawn from the sim every
// frame, so a reload or a lobby trip redraws them as they are, each with its own event juice. The World owns your
// bench, the room and the camera, and asks the stations about their cards and sales.

export class Stations {
  /** Pixel world, just over the table and under the tray: the grid machine, the locker's cabinet. */
  readonly under = new Container();
  /** Pixel world, the reel row: the bot's reels. */
  readonly reels = new Container();
  /** Pixel world, over your bench: the bot, its cards, the locker's results. */
  readonly over = new Container();
  /** HD layer: glows, lamps and counts, flashes, knives, breakouts. */
  readonly hd = new Container();
  private readonly bot: BotStation;

  constructor(d: StationDeps) {
    this.bot = new BotStation(d);
    this.reels.addChild(this.bot.reels.root);
    this.over.addChild(this.bot.sprite.root, this.bot.cards.root);
    this.hd.addChild(this.bot.cards.hdRoot);
  }

  layout(l: TableLayout): void {
    this.bot.layout(l);
  }

  update(dt: number, ms: number, s: RunState): void {
    this.bot.update(dt, ms, s);
  }

  /** A fresh World (a reload, a lobby trip) or a new run: redraw what the sim holds. */
  restore(plan: RestorePlan): void {
    this.bot.restore(plan);
  }

  onEvent(e: SimEvent): void {
    if (e.type === "runStarted") this.clearAll();
    if (e.type === "vaultBought") this.cancelDrags();
    this.bot.onEvent(e);
  }

  /** Pick up a waiting card under the pointer (the locker's results first: they sit over the tray's end). */
  grabCard(p: Pt): boolean {
    return this.bot.cards.pointerDown(p);
  }

  pointerMove(p: Pt): void {
    this.bot.cards.pointerMove(p);
  }

  pointerUp(p: Pt): void {
    this.bot.cards.pointerUp(p);
  }

  lifted(): LiftInfo | null {
    return this.bot.cards.lifted();
  }

  /** Every drag goes home and every knife lands at once (a resize, the vault, a lobby trip). */
  cancelDrags(): void {
    this.bot.cards.cancelDrag();
    this.bot.cards.cancelKnife();
  }

  /** Where a station's card is (coins start there). */
  cardCentre(_spot: "bot" | "locker", slot: number): Pt {
    return this.bot.cards.centre(slot);
  }

  destroy(): void {
    this.bot.cards.destroy();
  }

  private clearAll(): void {
    this.bot.cards.clearAll();
  }
}
