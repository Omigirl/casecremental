import { Container, Graphics, Text, Texture } from "pixi.js";
import { t } from "../../i18n/index";
import { skinById } from "../../sim/content/cases";
import { gridStalled } from "../../sim/grid";
import { RARITY_INFO } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import type { Drop } from "../../sim/types";
import { cardBurst } from "../benchFx";
import { BreakoutCard, BreakoutQueue, breakoutPeak, breakoutSeconds, breakoutTarget } from "../hd/breakout";
import { pixelStyle } from "../hd/font";
import { bigReveal } from "../juice/bigReveal";
import { Actor } from "../pixel/Actor";
import { cardFace } from "../pixel/cardFace";
import { GridBoard } from "../pixel/GridBoard";
import type { Pt, Rect, TableLayout } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import type { Pose } from "../pixel/timeline";
import { Throttle } from "../throttle";
import type { StationDeps } from "./deps";
import { boardRect, caseColor, gridCells } from "./gridRules";

// The auto-buyer grid (spec §6, Run 3+; a dark machine before): a board of tiny case cells over the machine's
// pigeonholes. Bought cases drop in, flicker and open; each opened cell flashes in its drop's colour and a sold drop
// sends one coin spark to the HUD; a stalled grid keeps its cells lit with a TRAY FULL hint. Covert and ★ break out
// over the table, one at a time (fx/hd/breakout). Machines fire ten times a second here, so every sound and spark is throttled.

const DIM = 0x8a8a9a;
const POSE: Pose = { frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open", look: 0 };
type SoldEvent = Extract<SimEvent, { type: "sold" }>;

export class GridStation {
  /** The machine, its board's backing and the cells (pixel world, under the tray). */
  readonly under = new Container();
  /** Flashes, the stall hint (HD). */
  readonly hd = new Container();
  private readonly machine: Actor;
  private readonly backing = new Graphics();
  private readonly board: GridBoard;
  private readonly stall = new Text({ text: "", style: pixelStyle(8, 0xffb020) });
  private readonly buySound = new Throttle(0.25);
  private readonly openSound = new Throttle(0.2);
  private readonly spark = new Throttle(0.15);
  private readonly storeSound = new Throttle(0.25);
  private readonly queue = new BreakoutQueue();
  private readonly card: BreakoutCard;
  private state: RunState | null = null;
  private l: TableLayout | null = null;
  private rects: Rect[] = [];
  private size = -1;
  private frame = -1;
  private powerT = Infinity;
  private t = 0;

  constructor(private readonly d: StationDeps) {
    this.machine = new Actor(d.lib.get("auto-buyer", { w: 57, h: 32, frames: 2 }));
    this.board = new GridBoard(Texture.WHITE, d.juice.hd.glowTexture);
    this.under.addChild(this.machine, this.backing, this.board.cells);
    this.stall.anchor.set(0.5, 1);
    this.stall.visible = false;
    this.card = new BreakoutCard(d.juice.hd.glowTexture);
    this.hd.addChild(this.board.flashes, this.stall, this.card.root);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.machine.place(l.grid.x + l.grid.w / 2, l.grid.y + l.grid.h);
    this.card.stop(); // its screen px changed
    this.frame = -1;
    this.size = -1; // re-lay the cells on the next update
    const k = this.d.scale();
    this.stall.style.fontSize = hdFontSize(k);
    this.stall.position.set((l.grid.x + l.grid.w / 2) * k, (l.grid.y - 1) * k);
  }

  /** Its breakout's ★ knife is in the air. */
  get knifeFlying(): boolean {
    return this.card.knifeFlying;
  }

  /** World centre of cell i, screen px (sparks and breakouts start there). */
  cellCentre(i: number): Pt {
    const r = this.rects[i] ?? this.l?.grid ?? { x: 0, y: 0, w: 0, h: 0 };
    return this.d.juice.hd.toScreen({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }

  update(dt: number, s: RunState): void {
    this.t += dt;
    this.powerT += dt;
    const g = s.grid;
    if (!this.l) return;
    if (g.cells.length !== this.size) this.relayout(g.cells.length);
    const frame = g.on ? 1 : 0;
    if (frame !== this.frame) {
      this.frame = frame;
      POSE.frame = frame;
      this.machine.show(POSE);
      this.machine.tint = g.on ? 0xffffff : DIM;
      this.backing.visible = g.on;
    }
    this.board.update(dt, g.cells, g.on, this.powerT, caseColor);
    this.state = s;
    const { start, expired } = this.queue.step(this.t, this.d.knifeFlying()); // a ★ waits for another knife to land
    for (const w of expired) this.board.opened(w.cell, RARITY_INFO[w.drop.rarity].color, true); // waited too long: a big flash
    if (start) this.breakOut(start.drop, start.cell);
    this.card.update(dt);
    const stalled = g.on && gridStalled(g);
    this.stall.visible = stalled && Math.floor(this.t * 4) % 2 === 0; // ~2 Hz, like the tray's
    if (stalled) {
      const text = t("float.trayfull");
      if (this.stall.text !== text) this.stall.text = text;
    }
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    switch (e.type) {
      case "gridBought":
        // the station's reveal: a warm light, its relays sweeping on left to right, its hum
        this.powerT = 0;
        hd.flash(0xffb020, 0.2);
        audio.play("grid-power-on");
        break;
      case "gridUpgraded":
        audio.play("seller-power-on", { rate: 1.4, gain: 0.4 });
        break;
      case "gridFilled":
        this.board.filled(e.cell);
        if (this.buySound.ready(this.t)) audio.play("grid-buy");
        break;
      case "gridOpened":
        if (e.drop.rarity === "covert" || e.drop.rarity === "gold") this.queue.push({ drop: e.drop, cell: e.cell, at: this.t });
        else this.board.opened(e.cell, RARITY_INFO[e.drop.rarity].color, e.drop.rarity === "classified");
        if (this.openSound.ready(this.t)) audio.play("grid-open");
        break;
      case "stored":
        if (e.from === "grid" && this.storeSound.ready(this.t)) audio.play("tray-store", { gain: 0.4 });
        break;
      case "runStarted":
        this.board.clear();
        this.queue.clear();
        this.card.stop();
        this.powerT = Infinity;
        break;
      case "vaultBought": // the vault takes the screen: nothing breaks out over it
        this.queue.clear();
        this.card.stop();
        break;
    }
  }

  /** A grid drop sold by the auto-seller (or cashed in by the vault): one coin spark from its cell, at most ~7 a
   *  second, no text and no till. True when it was the grid's. */
  sold(e: SoldEvent): boolean {
    if (e.from !== "grid" && e.source !== "grid") return false;
    if (this.spark.ready(this.t)) {
      this.d.juice.hd.coins.spark(this.cellCentre(e.slot), this.d.hud());
      this.d.juice.audio.play("coin-clink", { gain: 0.3, rate: 1.4 });
    }
    return true;
  }

  destroy(): void {
    this.board.clear();
    this.card.stop();
  }

  /** A Covert or ★ from cell `cell` bursts out over the table: the breakout sound, then the big reveal's juice
   *  (Covert's hit, ★'s slow-mo, flash — through the flash gate — and its knife showcase). No camera zoom: it centres
   *  on your bench. */
  private breakOut(drop: Drop, cell: number): void {
    const l = this.l;
    const s = this.state;
    if (!l || !s) return;
    const { hd, audio } = this.d.juice;
    const k = this.d.scale();
    const art = this.d.skins.frames(skinById(drop.skinId))[0] ?? null;
    const gold = drop.rarity === "gold";
    const from = this.cellCentre(cell);
    const peak = hd.toScreen(breakoutPeak(l));
    const cellWorld = { x: from.x / k, y: from.y / k };
    this.card.start({
      full: this.bake(art, drop),
      empty: gold ? this.bake(null, drop) : null,
      knife: gold ? art : null,
      color: RARITY_INFO[drop.rarity].color,
      from,
      peak,
      to: hd.toScreen(breakoutTarget(s, drop.id, cell, l, cellWorld)),
      total: breakoutSeconds(drop.rarity),
      scale: k,
    });
    audio.play("grid-breakout");
    const b = cardBurst(drop.rarity, k);
    hd.particles.burst(peak, RARITY_INFO[drop.rarity].color, b.count, b.speed);
    bigReveal(this.d.juice, drop.rarity, false);
  }

  private bake(art: Texture | null, drop: Drop): Texture {
    const face = cardFace(art, drop);
    const tex = this.d.bake(face);
    face.destroy({ children: true });
    return tex;
  }

  private relayout(size: number): void {
    const l = this.l!;
    this.size = size;
    const board = boardRect(l.grid, this.machine.meta);
    this.rects = gridCells(board, size);
    this.board.layout(this.rects, this.d.scale());
    this.backing
      .clear()
      .rect(board.x - 1, board.y - 1, board.w + 2, board.h + 2)
      .fill({ color: 0x120e10 });
  }
}
