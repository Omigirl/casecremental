import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { lockerCounts, tradeUpRarity, type LockerState } from "../../sim/locker";
import { RARITY_INFO, RARITY_ORDER } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import { TRADE_UP_COUNT } from "../../sim/tuning";
import type { RarityId } from "../../sim/types";
import { cardBurst } from "../benchFx";
import { pixelStyle } from "../hd/font";
import { bigReveal } from "../juice/bigReveal";
import { Actor } from "../pixel/Actor";
import { bestSlot } from "../pixel/BenchCards";
import { CardStation } from "../pixel/CardStation";
import { lockerCardSpots, type Pt, type TableLayout } from "../pixel/layout";
import type { Pose } from "../pixel/timeline";
import { Throttle } from "../throttle";
import type { StationDeps } from "./deps";
import {
  chipProgress,
  DOOR_OPEN_SECONDS,
  lampFontSize,
  lampRows,
  lockerDoor,
  lockerFrame,
  lockerFrameDx,
  POWER_LAMP_STEP,
  stampCrossed,
  storeFlightAt,
} from "./lockerRules";

// The locker (spec §5, Run 2+; an unlit cabinet before): five rarity lamps with counts on its face, a drop target for
// any waiting card, a tap to press a trade-up, the press (ten cards fly in, it stamps), and its results waiting on
// top — sold, held or dragged back in like the bot's cards. Drawn from the sim every frame.

const DIM = 0x8a8a9a;
const POSE: Pose = { frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open", look: 0 };
/** Cards the auto-seller's Collect sends in at once (more wait for a free one: they are throttled anyway). */
const FLIGHTS = 4;

interface Flight {
  readonly chip: Sprite;
  from: Pt;
  t: number;
}

export class LockerStation {
  /** The cabinet and the flying chips (pixel world, under the tray). */
  readonly under = new Container();
  /** Its waiting results and the cards flying in from their spots (pixel world, over the bench). */
  readonly over = new Container();
  /** Lamps, counts, glows, the knife (HD). */
  readonly hd = new Container();
  private readonly cabinet: Actor;
  private readonly chips: Sprite[] = [];
  private readonly flights: Flight[] = [];
  private readonly lamps = new Graphics();
  private readonly counts: Text[] = [];
  private readonly cards: CardStation;
  private readonly storeSound = new Throttle(0.2);
  private l: TableLayout | null = null;
  private frame = -1;
  private doorLeft = 0;
  private powerT = Infinity;
  private lastPress: number | null = null;
  private countsKey = "";
  private lampsKey = "";
  private tally: Record<RarityId, number> = lockerCounts([]);
  /** The rarity a press would take now (the lowest with ten in, never ★), or null. */
  private ready: RarityId | null = null;
  private t = 0;

  constructor(private readonly d: StationDeps) {
    this.cabinet = new Actor(d.lib.get("locker", { w: 32, h: 44, frames: 4 }));
    this.under.addChild(this.cabinet);
    for (let i = 0; i < TRADE_UP_COUNT; i++) this.chips.push(this.under.addChild(chip()));
    this.cards = new CardStation(
      { spot: "locker", spots: lockerCardSpots, sell: (slot) => ({ type: "sellLocker", slot }), burst: (r) => cardBurst(r, d.scale()) },
      d,
    );
    this.over.addChild(this.cards.root);
    for (let i = 0; i < FLIGHTS; i++) this.flights.push({ chip: this.over.addChild(chip()), from: { x: 0, y: 0 }, t: Infinity });
    for (let i = 0; i < RARITY_ORDER.length; i++) {
      const txt = new Text({ text: "", style: pixelStyle(8, 0xf2e9dc) });
      txt.anchor.set(0, 0.5);
      this.counts.push(txt);
    }
    this.hd.addChild(this.lamps, ...this.counts, this.cards.hdRoot);
  }

  get results(): CardStation {
    return this.cards;
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.cabinet.place(l.locker.x + l.locker.w / 2, l.locker.y + l.locker.h);
    this.frame = -1;
    this.lampsKey = "";
    this.cards.layout(l);
    const k = this.d.scale();
    const rows = lampRows(l.locker);
    this.counts.forEach((txt, i) => {
      txt.style.fontSize = lampFontSize(k);
      txt.position.set(rows[i]!.text.x * k, rows[i]!.text.y * k);
    });
  }

  update(dt: number, ms: number, s: RunState): void {
    this.t += dt;
    this.powerT += dt;
    this.doorLeft = Math.max(0, this.doorLeft - dt);
    const k = s.locker;
    const press = k.press?.elapsed ?? null;
    if (stampCrossed(this.lastPress, press ?? -1)) this.stamp();
    this.lastPress = press;
    const frame = lockerFrame(k.on, press, this.doorLeft);
    if (frame !== this.frame) {
      this.frame = frame;
      POSE.frame = frame;
      POSE.dx = lockerFrameDx(frame);
      this.cabinet.show(POSE);
      this.cabinet.tint = k.on ? 0xffffff : DIM;
    }
    this.drawChips(k);
    this.drawFlights(dt);
    this.drawLamps(k);
    this.cards.update(ms, dt, k.cards);
  }

  /** A tap on the cabinet presses a trade-up (the sim refuses when none is ready). True when the tap was on it. */
  tap(p: Pt, on: boolean): boolean {
    const r = this.l?.locker;
    if (!on || !r || p.x < r.x || p.y < r.y || p.x >= r.x + r.w || p.y >= r.y + r.h) return false;
    this.d.controller.act({ type: "tradeUp" });
    return true;
  }

  /** A card the auto-seller's Collect sent in flies from its spot (world px) into the door. */
  storedFrom(from: Pt, rarity: RarityId): void {
    const f = this.flights.find((x) => x.t === Infinity) ?? this.flights.reduce((a, b) => (b.t > a.t ? b : a)); // else the nearest in
    f.from = from;
    f.t = 0;
    f.chip.tint = RARITY_INFO[rarity].color;
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    switch (e.type) {
      case "lockerBought": {
        // the station's reveal: a cold-blue light, the lamps coming on one by one, its hum
        this.powerT = 0;
        hd.flash(0x6ab0ff, 0.2);
        hd.particles.burst(this.screenCentre(), 0x6ab0ff, 30, (180 * this.d.scale()) / 6);
        audio.play("locker-power-on");
        break;
      }
      case "lockerUpgraded":
        audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "autoContractBought":
        audio.play("seller-power-on", { rate: 1.5, gain: 0.5 });
        hd.particles.burst(this.screenCentre(), 0xffd34d, 24, (160 * this.d.scale()) / 6);
        break;
      case "lockerStored":
        this.doorLeft = DOOR_OPEN_SECONDS;
        if (e.byHand || this.storeSound.ready(this.t)) audio.play("locker-store", { gain: e.byHand ? 1 : 0.5 });
        break;
      case "pressDone": {
        this.cards.revealed(e.results);
        audio.play("tradeup-reveal");
        const best = e.results[bestSlot(e.results) ?? 0];
        if (best) bigReveal(this.d.juice, best.rarity, false, { time: false }); // Covert: the red hit; ★: the slow-mo and the knife
        break;
      }
      case "runStarted":
        this.cards.clearAll();
        this.doorLeft = 0;
        this.powerT = Infinity;
        this.lastPress = null;
        for (const f of this.flights) f.t = Infinity;
        break;
    }
  }

  destroy(): void {
    this.cards.destroy();
  }

  private stamp(): void {
    const { hd, audio, shake } = this.d.juice;
    audio.play("tradeup-press");
    shake.add(0.25);
    hd.particles.burst(this.screenCentre(-12), 0xf2e9dc, 16, (120 * this.d.scale()) / 6, -300); // a puff of steam
  }

  /** The cabinet's middle (or `dy` world px above it), screen px. */
  private screenCentre(dy = 0): Pt {
    const r = this.l?.locker ?? { x: 0, y: 0, w: 0, h: 0 };
    return this.d.juice.hd.toScreen({ x: r.x + r.w / 2, y: r.y + r.h / 2 + dy });
  }

  /** The ten inputs fly from the cabinet's door up into the press on its top. */
  private drawChips(k: LockerState): void {
    const r = this.l?.locker;
    const press = k.press;
    this.chips.forEach((s, i) => {
      const p = press && r ? chipProgress(i, this.chips.length, press.elapsed) : 0;
      s.visible = !!press && !!r && p > 0 && p < 1;
      if (!s.visible || !press || !r) return;
      s.tint = RARITY_INFO[press.rarity].color;
      const from = { x: r.x + 5 + (i % 5) * 3, y: r.y + 18 + Math.floor(i / 5) * 3 };
      const to = { x: r.x + r.w / 2 - 2, y: r.y + 1 };
      s.position.set(Math.round(from.x + (to.x - from.x) * p), Math.round(from.y + (to.y - from.y) * p - 8 * Math.sin(Math.PI * p)));
    });
  }

  /** Collected cards on their way in (a chip of their rarity, whole px). */
  private drawFlights(dt: number): void {
    const r = this.l?.locker;
    for (const f of this.flights) {
      if (f.t !== Infinity) f.t += dt;
      const at = r ? storeFlightAt(f.from, lockerDoor(r), f.t) : null;
      if (!at) f.t = Infinity;
      f.chip.visible = !!at;
      if (at) f.chip.position.set(Math.round(at.x - 2), Math.round(at.y - 1));
    }
  }

  /** Five lamps and their counts; the rarity ready to press blinks (2 Hz, one small lamp). The counts are recounted
   *  only when the items change, and the lamps redrawn only when something they show changed. */
  private drawLamps(k: LockerState): void {
    const l = this.l;
    if (!l) return;
    const itemsKey = `${k.items.length}:${k.items[0]?.id ?? ""}:${k.items.at(-1)?.id ?? ""}`;
    if (itemsKey !== this.countsKey) {
      this.countsKey = itemsKey;
      this.tally = lockerCounts(k.items);
      this.ready = tradeUpRarity(k.items);
      RARITY_ORDER.forEach((r, i) => {
        const text = String(this.tally[r]);
        if (this.counts[i]!.text !== text) this.counts[i]!.text = text;
        this.counts[i]!.alpha = this.tally[r] > 0 ? 1 : 0.45;
      });
    }
    const lit = k.on ? Math.min(5, Math.floor(this.powerT / POWER_LAMP_STEP) + 1) : 0;
    const blink = this.ready ? Math.floor(this.t * 4) % 2 : 0;
    const s = this.d.scale();
    const key = `${lit}|${itemsKey}|${blink}|${s}`;
    if (key === this.lampsKey) return;
    this.lampsKey = key;
    const rows = lampRows(l.locker);
    this.lamps.clear();
    RARITY_ORDER.forEach((r, i) => {
      this.counts[i]!.visible = i < lit;
      if (i >= lit) return;
      const on = this.tally[r] > 0 && !(r === this.ready && blink === 1);
      this.lamps
        .circle(rows[i]!.lamp.x * s, rows[i]!.lamp.y * s, Math.max(1.5, s * 0.8))
        .fill({ color: RARITY_INFO[r].color, alpha: on ? 1 : 0.25 });
    });
  }
}

/** A card in flight, as a small chip of its rarity's colour (pixel world). */
function chip(): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.width = 4;
  s.height = 3;
  s.visible = false;
  return s;
}
