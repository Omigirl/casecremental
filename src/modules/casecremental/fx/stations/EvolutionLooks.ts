import { Container, Graphics, Sprite } from "pixi.js";
import { t } from "../../i18n/index";
import type { EvolutionId } from "../../sim/evolved";
import type { RunState, SimEvent } from "../../sim/run";
import { MULTI_OPEN_MAX } from "../../sim/tuning";
import { benchReelArea, type Pt, type Rect, type TableLayout } from "../pixel/layout";
import { slotRects } from "../reel/slotLayout";
import type { StationDeps } from "./deps";
import { BELT_SPEED, BELT_STRIPE, beltRect, CHAIN_SAG, chainRect, hotHand, rideAt, shadesRect, slotFrameRect } from "./evolutionRules";
import { BillStream, FlameTrail } from "./EvolutionStreams";

// The evolutions' looks on the table (finish spec §7.3), drawn from the sim every frame so a reload shows every owned
// look at once: Slot Machine's gold frame round your reel window (with five slot columns while ten reels spin),
// Assembly Line's belt left of the case (its rollers running while auto-spin is on), Cartel's shades and gold chain on
// the bot (on its eyes, so they follow every pose), Hot Hand's flames at the pointer while it burns. Events are
// one-shot juice only: the evolve reveal, a case riding the belt into the bench on each auto-spin buy, Money Printer's
// bills on each seller sale (EvolutionStreams.ts).

const GOLD = 0xffd34d;
const GOLD_DARK = 0x8a5a12;
const LAMP = 0xfff4d6;
const RUBBER = 0x1a1a1f;
const RUBBER_TOP = 0x2c2c33;
const ROLLER = 0x44444f;
const BRASS = 0xb08d3a;
const SHADES = 0x0b0b10;
const GLINT = 0xffffff;

export class EvolutionLooks {
  /** Pixel world, on the table under your bench: the belt and the case riding it. */
  readonly under = new Container();
  /** Pixel world, the reel row over your reels: the gold frame. */
  readonly reelRow = new Container();
  /** Pixel world, over the bot: its shades and chain. */
  readonly over = new Container();
  /** HD layer: the bills. */
  readonly hd = new Container();
  private readonly frame = new Graphics();
  private readonly bling = new Graphics();
  private readonly bills: BillStream;
  private readonly flames: FlameTrail;
  private blingKey = "";
  /** The last pointer on the table (world px), or null until one is seen. */
  private pointer: Pt | null = null;
  private readonly belt = new Graphics();
  private readonly rider = new Sprite();
  private l: TableLayout | null = null;
  private frameKey = "";
  private beltKey = "";
  private beltOffset = 0;
  private rideT = Infinity;
  /** Cartel: black shades with a white glint over the bot's eyes and a gold chain with a medallion under them, redrawn
   *  only when the bot's pose moves them. */
  private drawBling(on: boolean): void {
    const eyes = on ? this.botEyes() : [];
    const sh = shadesRect(eyes);
    const ch = chainRect(eyes);
    this.bling.visible = sh !== null && ch !== null;
    if (!sh || !ch) return;
    const key = `${sh.x},${sh.y},${sh.w},${ch.x},${ch.y}`;
    if (key === this.blingKey) return;
    this.blingKey = key;
    const g = this.bling.clear();
    g.rect(sh.x, sh.y, sh.w, sh.h).fill(SHADES);
    g.rect(sh.x + 1, sh.y, 2, 1).fill(GLINT); // a glint on each lens
    g.rect(sh.x + Math.ceil(sh.w / 2) + 1, sh.y, 1, 1).fill(GLINT);
    g.rect(sh.x, sh.y + sh.h, sh.w, 1).fill(GOLD_DARK); // the frame's gold rim, so the shades read on the dark visor
    const half = (ch.w - 1) / 2;
    for (let i = 0; i < ch.w; i++) {
      const f = (i - half) / half;
      g.rect(ch.x + i, ch.y + Math.round(CHAIN_SAG * (1 - f * f)), 1, 1).fill(GOLD);
    }
    g.rect(ch.x + Math.floor(half), ch.y + CHAIN_SAG, 2, 2).fill(GOLD);
  }

  /** The ground row of the rider's frame (its feet, like the bench's case actor). */
  private riderGround = 0;

  constructor(
    private readonly d: StationDeps,
    /** The awake bot's eye centres this frame, world px (none asleep). */
    private readonly botEyes: () => Pt[],
  ) {
    this.rider.visible = false;
    this.under.addChild(this.belt, this.rider);
    this.reelRow.addChild(this.frame);
    this.over.addChild(this.bling);
    this.bills = new BillStream(d.bake);
    this.hd.addChild(this.bills.root);
    this.flames = new FlameTrail(d.juice.hd.particles);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.frameKey = this.beltKey = ""; // redraw at the new size
  }

  update(dt: number, s: RunState): void {
    const l = this.l;
    if (!l) return;
    const owned = s.evolutions.owned;
    this.drawFrame(l, s, owned.includes("slotMachine"));
    this.drawBelt(l, dt, s, owned.includes("assemblyLine"));
    this.drawBling(owned.includes("cartel") && s.bot.awake);
    const k = this.d.scale();
    this.bills.update(dt, k);
    const p = this.pointer;
    const burning = hotHand(s) && p !== null && inside(l.table, p);
    this.flames.update(dt, burning ? this.d.juice.hd.toScreen(p) : null, k);
  }

  /** The pointer moved (world px): Hot Hand's flames follow it. */
  pointerMove(p: Pt): void {
    this.pointer = p;
  }

  onEvent(e: SimEvent): void {
    switch (e.type) {
      case "autoSpinPulled":
        if (this.d.controller.run.state.evolutions.owned.includes("assemblyLine")) this.ride(e.caseId);
        break;
      case "evolved":
        this.reveal(e.id);
        break;
      case "sold":
        if (e.source === "seller" && this.l && this.d.controller.run.state.evolutions.owned.includes("moneyPrinter")) {
          const { hd } = this.d.juice;
          this.bills.launch(hd.toScreen({ x: this.l.seller.x, y: this.l.seller.y - 14 }), hd.toScreen(this.d.hud()), this.d.scale());
        }
        break;
      case "runStarted":
        this.rideT = Infinity;
        this.rider.visible = false;
        this.bills.clear();
        break;
    }
  }

  destroy(): void {
    this.frame.destroy();
    this.belt.destroy();
    this.bling.destroy();
    this.bills.destroy();
  }

  /** Slot Machine: a 2-px gold frame with marquee lamps (steady, never blinking); dividers between the slot columns
   *  while more than multi-open's widest reels spin. Redrawn only when its rect or columns change. */
  private drawFrame(l: TableLayout, s: RunState, on: boolean): void {
    this.frame.visible = on;
    if (!on) return;
    const r = slotFrameRect(l, s.bench);
    const n = s.bench.phase === "spinning" ? s.bench.reels.length : 1;
    const slots = n > MULTI_OPEN_MAX;
    const key = `${r.x},${r.y},${r.w},${r.h},${slots}`;
    if (key === this.frameKey) return;
    this.frameKey = key;
    const g = this.frame.clear();
    ring(g, r, GOLD);
    ring(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, GOLD_DARK);
    if (slots) {
      const area = benchReelArea(l, n, true);
      const cols = slotRects(area, n).slice(1, 5);
      for (const c of cols) g.rect(c.x - 1, area.y, 1, area.h).fill(GOLD_DARK);
    }
    for (let i = 1; i <= 5; i++) g.rect(r.x + Math.round((i * r.w) / 6) - 1, r.y, 2, 2).fill(LAMP);
  }

  /** Assembly Line: a rubber belt with roller stripes sliding while auto-spin is on, brass end caps; the case riding
   *  in rides on it. */
  private drawBelt(l: TableLayout, dt: number, s: RunState, owned: boolean): void {
    const b = owned ? beltRect(l) : null;
    this.belt.visible = b !== null;
    this.rideT += dt;
    const p = b ? rideAt(b, l.you.caseSpot, this.rideT) : null;
    this.rider.visible = p !== null;
    if (p) {
      const tex = this.rider.texture;
      this.rider.position.set(Math.round(p.x - Math.floor(tex.width / 2)), Math.round(p.y - this.riderGround));
    }
    if (!b) return;
    if (s.autoSpin.on) this.beltOffset = (this.beltOffset + BELT_SPEED * dt) % BELT_STRIPE;
    const key = `${b.x},${b.y},${b.w},${Math.floor(this.beltOffset)}`;
    if (key === this.beltKey) return;
    this.beltKey = key;
    const g = this.belt.clear();
    g.rect(b.x, b.y, b.w, b.h).fill(RUBBER);
    g.rect(b.x, b.y, b.w, 1).fill(RUBBER_TOP);
    for (let x = b.x + 2 + Math.floor(this.beltOffset); x < b.x + b.w - 2; x += BELT_STRIPE) g.rect(x, b.y + 1, 1, b.h - 1).fill(ROLLER);
    g.rect(b.x, b.y, 2, b.h).fill(BRASS);
    g.rect(b.x + b.w - 2, b.y, 2, b.h).fill(BRASS);
  }

  /** An auto-spin buy with Assembly Line: the case box slides along the belt into the bench. */
  private ride(caseId: string): void {
    const set = this.d.lib.get(`case-${caseId}`, { w: 26, h: 34, frames: 4 });
    this.rider.texture = set.frames[0]!;
    this.riderGround = set.meta.ground;
    this.rideT = 0;
  }

  /** An evolution bought: gold sparks at its look, a gated gold flash, the stage-up hit and "EVOLVED!". */
  private reveal(id: EvolutionId): void {
    const l = this.l;
    if (!l) return;
    const { hd, audio } = this.d.juice;
    const k = this.d.scale();
    hd.particles.burst(hd.toScreen(lookSpot(l, id)), GOLD, 40, (160 * k) / 6);
    hd.flash(GOLD, 0.25); // the flash gate decides
    audio.play("stage-up");
    hd.coins.floatText(hd.toScreen({ x: l.table.x + l.table.w / 2, y: l.table.y + 12 }), t("float.evolved"));
  }
}

const inside = (r: Rect, p: Pt): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** A 1-px outline of `r`. */
function ring(g: Graphics, r: Rect, color: number): void {
  g.rect(r.x, r.y, r.w, 1).fill(color);
  g.rect(r.x, r.y + r.h - 1, r.w, 1).fill(color);
  g.rect(r.x, r.y + 1, 1, r.h - 2).fill(color);
  g.rect(r.x + r.w - 1, r.y + 1, 1, r.h - 2).fill(color);
}

/** Where an evolution's look is (its reveal sparks start there), world px. */
function lookSpot(l: TableLayout, id: EvolutionId): Pt {
  switch (id) {
    case "slotMachine":
      return { x: l.you.reel.x + l.you.reel.w / 2, y: l.you.reel.y + l.you.reel.h / 2 };
    case "cartel":
      return { x: l.bot.spot.x, y: l.bot.spot.y - 24 };
    case "moneyPrinter":
      return { x: l.seller.x, y: l.seller.y - 12 };
    case "assemblyLine":
      return l.you.caseSpot;
    case "hotHand":
      return { x: l.table.x + l.table.w / 2, y: l.table.y + l.table.h / 2 };
  }
}
