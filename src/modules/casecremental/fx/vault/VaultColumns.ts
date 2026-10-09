import { Container, Graphics, Sprite, Text, Texture, type Renderer } from "pixi.js";
import { skinName } from "../../i18n/content";
import { getLang } from "../../i18n/index";
import { CASES, skinById } from "../../sim/content/cases";
import { formatCash } from "../../sim/format";
import { RARITY_INFO } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import { VAULT_LAND_TIMES } from "../../sim/tuning";
import type { Drop, SkinDef } from "../../sim/types";
import { moneyStyle, pixelStyle } from "../hd/font";
import type { Juice } from "../juice/juice";
import type { Pt, Rect, TableLayout } from "../pixel/layout";
import { PixelLayer } from "../pixel/PixelLayer";
import { hdFontSize } from "../pixel/screen";
import type { PixelViewport } from "../pixel/viewport";
import { frameAt } from "../skins/motion";
import type { SkinTextures } from "../skins/pixelSkin";
import { COLUMN_GAP, COLUMN_SLOW_CELLS, columnMotion, columnRects } from "./columnMotion";
import { VAULT_CUES, vaultCues } from "./cues";
import { fitLabel, LABEL_MIN_SHARE, labelWidth } from "./fitLabel";
import type { VaultScene } from "./VaultScene";
import { vaultReelArea } from "./vaultLayout";

// Vault Case I's five reels as vertical slot columns (spec 2026-10-09 §1-2): they cascade in, spin, and lock in
// one by one, left to right, on the drops the sim already rolled — each landing louder than the last, the
// fifth (the animated ★) the loudest. The columns are a pixel layer of their own in the vault scene's reel
// slot; their labels (name, +$) and the fifth's halo are HD, in the slot's screen px.

const N = VAULT_LAND_TIMES.length;
/** Cells a column's window shows; the middle one is framed and is where a drop locks in. */
const CELLS = 3;
const GAP = COLUMN_GAP;
const MIN_CELL = 12;
const MAX_CELL = 20;
/** The spin's speed (cells/s); each column's exact speed follows from its own start, landing and target. */
const SPEED = 14;
/** The fifth decelerates longer: its lock-in is the one the whole opening builds to. */
const LAST_SLOW_CELLS = 9;
/** Label lines reserved under the columns: a name up to three lines, then its +$. */
const LABEL_LINES = 4;
const PULSE_SECONDS = 0.15;
const FLASH_SECONDS = 0.4;
const LABEL_FADE_SECONDS = 0.3;
const BORDER = 0x120e10;
const WINDOW = 0x07080c;
const METAL = 0x56607a;
const GOLD = 0xffd34d;

interface Column {
  readonly root: Container;
  readonly cells: Sprite[];
  readonly clip: Graphics;
  /** The window's fill, under the strip. */
  readonly back: Graphics;
  /** The border, the shaded outer cells and the framed middle one, over the strip. */
  readonly frame: Graphics;
  readonly flash: Graphics;
  readonly name: Text;
  readonly money: Text;
  filler: SkinDef[];
  drop: SkinDef | null;
  amount: number;
  target: number;
  start: number;
  /** The sim time its lock-in juice started; -Infinity once restored at rest; null while it spins. */
  lockedAt: number | null;
  lastCell: number;
  /** What its name label was fitted for (the name, the column width, the scale). */
  fitted: string;
}

const outline = (g: Graphics, x: number, y: number, w: number, h: number, color: number) =>
  g
    .rect(x, y, w, 1)
    .rect(x, y + h - 1, w, 1)
    .rect(x, y, 1, h)
    .rect(x + w - 1, y, 1, h)
    .fill({ color });

const mod = (a: number, n: number) => ((a % n) + n) % n;

function haloTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

export class VaultColumns {
  private readonly pixel = new PixelLayer();
  private readonly columns: Column[] = [];
  private readonly haloTex = haloTexture();
  private readonly halo = new Sprite({ texture: this.haloTex, anchor: 0.5, blendMode: "add", tint: GOLD, alpha: 0 });
  private rects: Rect[] = [];
  private cellH = MIN_CELL;
  private k = 1;
  private t = 0;
  private glow = 0;

  constructor(
    private readonly skins: SkinTextures,
    private readonly scene: VaultScene,
    private readonly juice: Juice,
    /** Visual-only randomness (filler order, landing cells) — never the outcome. */
    private readonly rng: Rng,
  ) {
    for (let i = 0; i < N; i++) {
      const root = new Container();
      const cells = Array.from({ length: CELLS + 2 }, () => new Sprite({ anchor: 0.5 }));
      const strip = new Container({ sortableChildren: true }); // the locked cell pops over its neighbours
      strip.addChild(...cells);
      const clip = new Graphics();
      strip.mask = clip;
      const back = new Graphics();
      const frame = new Graphics();
      const flash = new Graphics();
      root.addChild(back, strip, clip, frame, flash);
      const name = new Text({ text: "", style: pixelStyle(8, 0xffffff) });
      const money = new Text({ text: "", style: moneyStyle(8) });
      for (const txt of [name, money]) txt.anchor.set(0.5, 0);
      this.pixel.world.addChild(root);
      this.columns.push({
        root,
        cells,
        clip,
        back,
        frame,
        flash,
        name,
        money,
        filler: [],
        drop: null,
        amount: 0,
        target: 0,
        start: 0,
        lockedAt: null,
        lastCell: NaN,
        fitted: "",
      });
    }
    this.pixel.world.visible = false;
    scene.reelSlot.addChild(this.halo, this.pixel.view, ...this.columns.flatMap((c) => [c.name, c.money]));
  }

  /** Five columns side by side across `area` (world px; by default the top of the table, above the chest),
   *  their labels under them. */
  layout(l: TableLayout, vp: PixelViewport, area: Rect = vaultReelArea(l)): void {
    const k = (this.k = vp.scale);
    this.pixel.resize(vp);
    const size = hdFontSize(k);
    const labelRoom = Math.ceil((LABEL_LINES * size * 1.3) / k) + 2;
    const band = { ...area, h: Math.max(CELLS * MIN_CELL + 2, area.h - labelRoom) };
    this.cellH = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor((band.h - 2) / CELLS)));
    const h = CELLS * this.cellH + 2;
    const y = Math.round(band.y + (band.h - h) / 2);
    this.rects = columnRects(band, N, GAP).map((r) => ({ ...r, y, h }));
    this.columns.forEach((c, i) => {
      const r = this.rects[i]!;
      c.clip
        .clear()
        .rect(1, 1, r.w - 2, r.h - 2)
        .fill({ color: 0xffffff });
      c.flash.clear();
      outline(c.flash, 0, 0, r.w, r.h, GOLD);
      outline(c.flash, 1, 1, r.w - 2, r.h - 2, GOLD);
      this.drawFrame(c, r);
      Object.assign(c.name.style, { wordWrap: false, align: "center" }); // fitLabel wraps it, at spaces only
      c.fitted = "";
      c.money.style.fontSize = size;
    });
    const last = this.rects[N - 1]!;
    this.halo.width = this.halo.height = last.w * k * 2.6;
  }

  set tint(v: number) {
    this.pixel.world.tint = v;
  }

  /** The celebration's golden pulse across the five frames (0-1). */
  pulse(v: number): void {
    this.glow = Math.min(1, Math.max(0, v));
  }

  /** The key turned: fresh strips that each end on its drop (decided by the sim), all spinning. */
  start(drops: readonly Drop[]): void {
    // never caseById on a vault drop (its case is "vault1"): the filler is the top case's skins
    const top = CASES[CASES.length - 1]!.skins;
    this.t = 0;
    this.glow = 0;
    this.columns.forEach((c, i) => {
      const d = drops[i];
      c.drop = d ? skinById(d.skinId) : null;
      c.amount = d?.value ?? 0;
      c.filler = this.shuffle(top);
      c.start = VAULT_CUES.columnsFrom + VAULT_CUES.columnStagger * i;
      c.target = Math.round(SPEED * (VAULT_LAND_TIMES[i]! - c.start)) - this.slowCells(i) + this.rng.int(0, 3);
      c.lockedAt = null;
      c.lastCell = NaN;
      this.drawFrame(c, this.rects[i]);
    });
    this.pixel.world.visible = true;
  }

  /** A reload mid-opening: the strips as they were, the columns already landed at rest with their labels. */
  restore(drops: readonly Drop[], landed: number): void {
    this.start(drops);
    this.columns.slice(0, landed).forEach((c, i) => {
      c.lockedAt = -Infinity;
      this.drawFrame(c, this.rects[i]);
    });
  }

  hide(): void {
    this.pixel.world.visible = false;
    this.halo.visible = false;
    for (const c of this.columns) c.name.visible = c.money.visible = false;
  }

  /** The opening at sim time t: the cascade-in, each strip where it is, the lock-ins' juice playing out. */
  update(t: number): void {
    if (!this.pixel.world.visible) return;
    this.t = t;
    const cues = vaultCues(t);
    this.columns.forEach((c, i) => {
      const r = this.rects[i];
      if (!r) return;
      const come = cues.columnIn[i]!;
      c.root.visible = come > 0;
      c.root.alpha = come;
      c.root.position.set(r.x, r.y - Math.round((1 - come) * 10));
      this.placeCells(c, i, r, t);
      const since = c.lockedAt === null ? Infinity : t - c.lockedAt;
      c.flash.alpha = Math.max(this.glow, 1 - since / FLASH_SECONDS);
      this.placeLabels(c, r, c.lockedAt === null ? 0 : Math.min(1, since / LABEL_FADE_SECONDS));
    });
    const last = this.columns[N - 1]!;
    const lr = this.rects[N - 1];
    this.halo.visible = last.lockedAt !== null && !!lr;
    if (lr) this.halo.position.set((lr.x + lr.w / 2) * this.k, (lr.y + lr.h / 2) * this.k);
    this.halo.alpha = 0.5 + 0.2 * Math.sin(t * 4) + 0.3 * this.glow;
  }

  render(renderer: Renderer): void {
    if (this.pixel.world.visible) this.pixel.render(renderer, true);
  }

  /** Column `index` locks in (and pays): a scale pulse, a gold flash, a star burst and a chime a whole tone
   *  higher than the last; the fifth, the animated ★, gets a bigger burst, the choir, a firework kick and a
   *  shake. */
  landed(index: number, d: Drop, amount: number): void {
    const c = this.columns[index];
    const r = this.rects[index];
    if (!c || !r) return;
    c.lockedAt = this.t;
    c.amount = amount;
    this.drawFrame(c, r);
    const { audio, shake } = this.juice;
    const at: Pt = { x: (r.x + r.w / 2) * this.k, y: (r.y + r.h / 2) * this.k };
    const color = RARITY_INFO[d.rarity].color;
    audio.play("reward-chime", { rate: 2 ** ((2 * index) / 12) });
    if (index < N - 1) {
      this.scene.firework(at, color, false);
      return;
    }
    this.scene.firework(at, color, true);
    this.scene.firework(at, GOLD, true);
    audio.play("legendary-choir");
    audio.play("firework", { gain: 0.8, rate: 0.9 });
    shake.add(0.25);
  }

  destroy(): void {
    for (const c of this.columns) {
      c.name.destroy();
      c.money.destroy();
    }
    this.halo.destroy();
    this.haloTex.destroy(true);
    this.pixel.destroy();
  }

  private slowCells(i: number): number {
    return i === N - 1 ? LAST_SLOW_CELLS : COLUMN_SLOW_CELLS;
  }

  private shuffle(skins: readonly SkinDef[]): SkinDef[] {
    const out = [...skins];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** The window: a 1-px dark border, the framed middle cell, and once landed a rarity-coloured inner line. */
  private drawFrame(c: Column, r: Rect | undefined): void {
    if (!r) return;
    const { w, h } = r;
    const ch = this.cellH;
    c.back.clear().rect(0, 0, w, h).fill({ color: WINDOW });
    const g = c.frame.clear();
    outline(g, 0, 0, w, h, BORDER);
    // the cells above and below sit in shadow; the middle one is framed
    g.rect(1, 1, w - 2, ch).fill({ color: 0x000000, alpha: 0.45 });
    g.rect(1, 1 + 2 * ch, w - 2, ch).fill({ color: 0x000000, alpha: 0.45 });
    if (c.lockedAt !== null && c.drop) outline(g, 1, 1, w - 2, h - 2, RARITY_INFO[c.drop.rarity].color);
    g.rect(1, ch, w - 2, 1)
      .rect(1, 2 * ch + 1, w - 2, 1)
      .fill({ color: METAL });
    const my = Math.floor(1 + ch * 1.5);
    g.rect(0, my, 2, 1)
      .rect(w - 2, my, 2, 1)
      .fill({ color: GOLD });
  }

  private skinAt(c: Column, cell: number): SkinDef | null {
    if (cell === c.target && c.drop) return c.drop;
    return c.filler.length ? c.filler[mod(cell, c.filler.length)]! : null;
  }

  /** The strip at sim time t: the cells around its position, the landed one pulsing, the ★ animating. */
  private placeCells(c: Column, i: number, r: Rect, t: number): void {
    const land = VAULT_LAND_TIMES[i]!;
    const slow = this.slowCells(i);
    const pos = columnMotion(t, c.start, land, c.target, { slowCells: slow });
    const ch = this.cellH;
    const mid = 1 + ch * 1.5;
    const base = Math.floor(pos) - 2;
    c.cells.forEach((s, n) => {
      const cell = base + n;
      const skin = this.skinAt(c, cell);
      s.visible = !!skin;
      if (!skin) return;
      const locked = cell === c.target && c.lockedAt !== null;
      const frames = this.skins.frames(skin);
      s.texture = locked ? frames[frameAt((t - land) * 1000, this.skins.fps(skin), frames.length)]! : frames[0]!;
      const pu = locked ? (t - c.lockedAt!) / PULSE_SECONDS : 1;
      const pop = pu > 0 && pu < 1 ? 1 + 0.15 * Math.sin(Math.PI * pu) : 1;
      s.scale.set(Math.min(1, (r.w - 4) / s.texture.width) * pop);
      s.position.set(Math.round(r.w / 2), Math.round(mid + (pos - cell) * ch));
      s.zIndex = locked ? 1 : 0;
    });
    // a tick for each cell that passes the middle while it slows down
    const now = Math.round(pos);
    if (now !== c.lastCell && t < land && c.target - pos <= slow && Number.isFinite(c.lastCell))
      this.juice.audio.play("reel-tick", { gain: 0.25, rate: 1 + i * 0.1 });
    c.lastCell = now;
  }

  private placeLabels(c: Column, r: Rect, alpha: number): void {
    const k = this.k;
    c.name.visible = c.money.visible = alpha > 0 && !!c.drop;
    if (!c.drop || alpha <= 0) return;
    const name = skinName(c.drop.id);
    const fitFor = `${name}|${r.w}|${k}`;
    if (c.fitted !== fitFor) {
      // whole words only; a word wider than the column shrinks this label's font (down to a floor)
      const base = hdFontSize(k);
      const fit = fitLabel(name.split(" "), labelWidth(r.w, k), 1, base, base * LABEL_MIN_SHARE);
      c.name.style.fontSize = fit.size;
      c.name.text = fit.lines.join("\n");
      c.name.style.fill = RARITY_INFO[c.drop.rarity].color;
      c.fitted = fitFor;
    }
    const money = `+${formatCash(c.amount, getLang())}`;
    if (c.money.text !== money) c.money.text = money;
    c.name.alpha = c.money.alpha = alpha;
    const x = (r.x + r.w / 2) * k;
    c.name.position.set(x, (r.y + r.h + 2) * k);
    c.money.position.set(x, c.name.y + c.name.height + k);
  }
}
