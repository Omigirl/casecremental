import { Container } from "pixi.js";
import { t } from "../../i18n/index";
import type { RunState, SimEvent } from "../../sim/run";
import type { RarityId } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { Pt, TableLayout } from "../pixel/layout";
import type { RestorePlan } from "../restore";
import { AutoSpinStation } from "./AutoSpinStation";
import { BotStation } from "./BotStation";
import type { StationDeps } from "./deps";
import { EvolutionLooks } from "./EvolutionLooks";
import { LockerStation } from "./LockerStation";
import { UpgraderDial } from "./UpgraderDial";

// The stations beside your bench (M3: the bot's pair, the locker; F2: auto-spin's arm; Run 4: the Upgrader's
// dial, the evolutions' looks): drawn from the sim every frame, so a reload or a lobby trip redraws them as they are,
// each with its own event juice. The World owns your bench, the room and the camera, and asks the stations about their
// cards and sales.

export class Stations {
  /** Pixel world, just over the table and under the tray: the locker's cabinet and auto-spin's arm. */
  readonly under = new Container();
  /** Pixel world, the reel row: the bot's reels. */
  readonly reels = new Container();
  /** Pixel world, over your bench: the bot, its cards, the locker's results. */
  readonly over = new Container();
  /** HD layer: glows, lamps and counts, flashes, knives, the arm's lamp glow. */
  readonly hd = new Container();
  private readonly bot: BotStation;
  private readonly locker: LockerStation;
  private readonly autoSpin: AutoSpinStation;
  private readonly evolutions: EvolutionLooks;
  private readonly dial: UpgraderDial;
  private l: TableLayout | null = null;

  constructor(private readonly d: StationDeps) {
    this.bot = new BotStation(d);
    this.reels.addChild(this.bot.reels.root);
    this.over.addChild(this.bot.sprite.root, this.bot.cards.root);
    this.hd.addChild(this.bot.cards.hdRoot);
    this.locker = new LockerStation(d);
    this.under.addChild(this.locker.under);
    this.over.addChild(this.locker.over);
    this.hd.addChild(this.locker.hd);
    this.autoSpin = new AutoSpinStation(d);
    this.under.addChild(this.autoSpin.under);
    this.hd.addChild(this.autoSpin.hd);
    this.evolutions = new EvolutionLooks(d, () => this.bot.sprite.eyes());
    this.under.addChild(this.evolutions.under);
    this.reels.addChild(this.evolutions.reelRow); // after the bot's reels: the gold frame draws over your reel window
    this.over.addChild(this.evolutions.over); // over the bot: Cartel's shades
    this.hd.addChild(this.evolutions.hd);
    this.dial = new UpgraderDial(d);
    this.hd.addChild(this.dial.hd);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.bot.layout(l);
    this.locker.layout(l);
    this.autoSpin.layout(l);
    this.evolutions.layout(l);
    this.dial.layout(l);
  }

  update(dt: number, ms: number, s: RunState): void {
    this.bot.update(dt, ms, s);
    this.locker.update(dt, ms, s);
    this.autoSpin.update(dt, s);
    this.evolutions.update(dt, s);
    this.dial.update(dt, s);
  }

  /** A fresh World (a reload, a lobby trip) or a new run: redraw what the sim holds. */
  restore(plan: RestorePlan): void {
    this.bot.restore(plan);
  }

  onEvent(e: SimEvent): void {
    if (e.type === "runStarted") this.clearAll();
    if (e.type === "vaultBought") this.cancelDrags();
    if (e.type === "setCompleted") this.fullSet();
    this.bot.onEvent(e);
    this.locker.onEvent(e);
    this.autoSpin.onEvent(e);
    this.evolutions.onEvent(e);
    this.dial.onEvent(e);
  }

  /** Pick up a waiting card under the pointer (the locker's results first: they sit over the tray's end). */
  grabCard(p: Pt): boolean {
    return this.locker.results.pointerDown(p) || this.bot.cards.pointerDown(p);
  }

  pointerMove(p: Pt): void {
    this.bot.cards.pointerMove(p);
    this.locker.results.pointerMove(p);
    this.evolutions.pointerMove(p);
  }

  pointerUp(p: Pt): void {
    this.bot.cards.pointerUp(p);
    this.locker.results.pointerUp(p);
  }

  lifted(): LiftInfo | null {
    return this.locker.results.lifted() ?? this.bot.cards.lifted();
  }

  /** Every drag goes home and every knife lands at once (a resize, the vault, a lobby trip). */
  cancelDrags(): void {
    this.bot.cards.cancelDrag();
    this.bot.cards.cancelKnife();
    this.locker.results.cancelDrag();
    this.locker.results.cancelKnife();
  }

  /** Where a station's card is (coins start there). */
  cardCentre(spot: "bot" | "locker", slot: number): Pt {
    return (spot === "locker" ? this.locker.results : this.bot.cards).centre(slot);
  }

  /** A tap on a machine (the arm flips auto-spin, the locker presses a trade-up); true when one took it. */
  tap(p: Pt, s: RunState): boolean {
    return this.autoSpin.tap(p, s) || this.locker.tap(p, s.locker.on);
  }

  /** A card the auto-seller's Collect sent into the locker flies there from `from` (world px). */
  storedFrom(from: Pt, rarity: RarityId): void {
    this.locker.storedFrom(from, rarity);
  }

  destroy(): void {
    this.bot.cards.destroy();
    this.locker.destroy();
    this.autoSpin.destroy();
    this.evolutions.destroy();
    this.dial.destroy();
  }

  private clearAll(): void {
    this.bot.cards.clearAll();
  }

  /** Collector's Eye (spec §8): every skin of a case revealed this run — its drops pay x2 from now on. */
  private fullSet(): void {
    const tb = this.l?.table;
    if (!tb) return;
    const { hd, audio } = this.d.juice;
    hd.coins.floatText(hd.toScreen({ x: tb.x + tb.w / 2, y: tb.y + 12 }), t("float.set"));
    audio.play("reward-chime");
  }
}
