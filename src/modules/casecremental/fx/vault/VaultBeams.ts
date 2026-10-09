import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
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
import { frameAt } from "../skins/motion";
import type { SkinTextures } from "../skins/pixelSkin";
import { drawBeam, drawRewardFrames } from "./beamArt";
import { BEAM_PALETTE, itemDistance, type Beam } from "./beams";
import { beamWidthAt, firstItem, firstVisible, iconScale, isCoin, itemJitter, lastVisible, maxVisibleItems } from "./beamStream";
import { COLUMN_SLOW_CELLS, columnMotion } from "./columnMotion";
import { VAULT_CUES, vaultCues } from "./cues";
import { fitLabel, LABEL_MIN_SHARE } from "./fitLabel";
import type { VaultLayout } from "./vaultLayout";
import type { VaultScene } from "./VaultScene";

// Vault Case I's five reels as five wide beams pouring out of the chest past the screen edges (spec 2026-10-09
// §5, after Vampire Survivors' legendary chest): they grow out of its mouth in the cascade, skin icons and coins
// stream along them, and they lock in one by one, left to right, on the drops the sim already rolled — each
// reward riding out to its spot on its beam, the beam's other items fading away, each landing louder than the
// last, the fifth (the animated ★) the loudest. Screen px, in the vault scene's slots: the beams behind the sky's
// particles, the streams behind the chest (they come out of it), the labels in front of every particle. Icons
// are drawn upright at a whole-number scale; the sprites are pooled per beam, so a frame allocates none.

const N = VAULT_LAND_TIMES.length;
/** Items per second along a beam while it spins; each beam's exact speed follows from its start, landing and
 *  target (columnMotion). */
const SPEED = 15; // 1.5× the calm version: the chaos runs hot
/** The fifth decelerates longer: its lock-in is the one the whole opening builds to. */
const LAST_SLOW_CELLS = 9;
/** Items stream this share of an icon box apart. */
const SPACING = 0.45;
/** Back to front: the outer beams first, the centre one last. */
const DRAW_ORDER = [0, 4, 1, 3, 2] as const;
/** The beam's core: its brightness at rest, once landed, and on the flash and the pulse. */
const CORE_ALPHA = 0.12;
const CORE_LIT = 0.18;
const PULSE_SECONDS = 0.2;
const POP = 0.3;
const FLASH_SECONDS = 0.4;
/** The other items fade out, and the label in, over this long after a lock-in. */
const FADE_SECONDS = 0.3;
const COIN_FPS = 14;
const GOLD = 0xffd34d;
const LABEL_BACK = 0x07080c;

interface Lane {
  /** The beam, drawn pointing straight up from its origin and rotated onto its angle. */
  readonly beam: Container;
  readonly body: Graphics;
  readonly core: Graphics;
  /** The stream's pooled sprites (icons and coins), never the reward. */
  readonly items: Container;
  readonly pool: Sprite[];
  readonly reward: Sprite;
  /** The reward's rarity outline and the gold one around it that flashes on the lock-in and the pulse. */
  readonly frame: Graphics;
  readonly flash: Graphics;
  readonly back: Graphics;
  readonly name: Text;
  readonly money: Text;
  geo: Beam | null;
  filler: SkinDef[];
  drop: SkinDef | null;
  amount: number;
  target: number;
  start: number;
  /** The scatter's seed: each item keeps its lane across the beam. */
  seed: number;
  /** The sim time its lock-in juice started; -Infinity once restored at rest; null while it spins. */
  lockedAt: number | null;
  lastCell: number;
  /** What the labels were last set for. */
  fitName: string;
  fitW: number;
  moneyFor: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export class VaultBeams {
  private readonly beamsRoot = new Container();
  private readonly streamRoot = new Container();
  private readonly labelsRoot = new Container();
  private readonly lanes: Lane[] = [];
  private readonly halo: Sprite;
  private readonly coins: readonly Texture[];
  private k = 1;
  private icon = 32;
  private spacing = 19;
  private coinScale = 1;
  private t = 0;
  private glow = 0;
  private active = false;

  constructor(
    private readonly skins: SkinTextures,
    private readonly scene: VaultScene,
    private readonly juice: Juice,
    /** Visual-only randomness (filler order, landing items, the scatter) — never the outcome. */
    private readonly rng: Rng,
  ) {
    this.coins = scene.art.coins;
    this.halo = new Sprite({ texture: scene.art.soft, anchor: 0.5, blendMode: "add", tint: GOLD, alpha: 0 });
    const top = { x: 0.5, y: 0 };
    for (let i = 0; i < N; i++) {
      const body = new Graphics();
      const core = new Graphics();
      this.lanes.push({
        beam: new Container({ children: [body, core] }),
        body,
        core,
        items: new Container(),
        pool: [],
        reward: new Sprite({ anchor: 0.5 }),
        frame: new Graphics(),
        flash: new Graphics(),
        back: new Graphics(),
        name: new Text({ text: "", style: pixelStyle(8, 0xffffff), anchor: top }),
        money: new Text({ text: "", style: moneyStyle(8), anchor: top }),
        geo: null,
        filler: [],
        drop: null,
        amount: 0,
        target: 0,
        start: 0,
        seed: 0,
        lockedAt: null,
        lastCell: NaN,
        fitName: "",
        fitW: 0,
        moneyFor: NaN,
      });
    }
    const ordered = DRAW_ORDER.map((i) => this.lanes[i]!);
    this.beamsRoot.addChild(...ordered.map((c) => c.beam));
    this.streamRoot.addChild(...ordered.map((c) => c.items), this.halo, ...ordered.flatMap((c) => [c.flash, c.frame, c.reward]));
    this.labelsRoot.addChild(...this.lanes.flatMap((c) => [c.back, c.name, c.money]));
    scene.beamSlot.addChild(this.beamsRoot);
    scene.streamSlot.addChild(this.streamRoot);
    scene.labelSlot.addChild(this.labelsRoot);
    this.hide();
  }

  /** The five beams from the vault's layout (screen px); k is the world's scale (screen px per world px). */
  layout(L: VaultLayout, k: number): void {
    this.k = k;
    this.icon = L.icon;
    this.spacing = Math.max(1, Math.round(L.icon * SPACING));
    this.coinScale = Math.max(1, Math.round(k * 0.6));
    this.lanes.forEach((c, i) => {
      const b = (c.geo = L.beams[i] ?? null);
      if (!b) return;
      drawBeam(c.body, c.core, b, BEAM_PALETTE[i] ?? GOLD, Math.max(1, k));
      c.beam.position.set(b.origin.x, b.origin.y);
      c.beam.rotation = b.angle;
      // the pool grows to the beam's reach here, never in a frame
      for (let n = c.pool.length; n < maxVisibleItems(b.length, this.spacing); n++) {
        const s = new Sprite();
        s.visible = false;
        c.items.addChild(s);
        c.pool.push(s);
      }
      const { x, y, w, h } = b.label;
      c.back.clear().rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).fill({ color: LABEL_BACK, alpha: 0.7 });
      Object.assign(c.name.style, { wordWrap: false, align: "center" });
      c.money.style.fontSize = b.label.h / 2; // a line of the box: smaller when the screen is crowded
      c.fitName = "";
      this.drawFrame(c);
    });
    this.halo.width = this.halo.height = L.icon * 2.6;
  }

  set tint(v: number) {
    this.beamsRoot.tint = this.streamRoot.tint = v;
  }

  /** The celebration's golden pulse across the five beams and frames (0-1). */
  pulse(v: number): void {
    this.glow = Math.min(1, Math.max(0, v));
  }

  /** The key turned: fresh streams that each end on its drop (decided by the sim), all pouring out. */
  start(drops: readonly Drop[]): void {
    // never caseById on a vault drop (its case is "vault1"): the filler is the top case's skins
    const top = CASES[CASES.length - 1]!.skins;
    // bake every skin the streams can show now, at the key turn, rather than as each first flies by mid-spin
    for (const skin of top) this.skins.frames(skin);
    this.t = 0;
    this.glow = 0;
    this.lanes.forEach((c, i) => {
      const d = drops[i];
      c.drop = d ? skinById(d.skinId) : null;
      if (c.drop) this.skins.frames(c.drop);
      c.amount = d?.value ?? 0;
      c.filler = this.shuffle(top);
      c.start = VAULT_CUES.columnsFrom + VAULT_CUES.columnStagger * i;
      c.target = Math.round(SPEED * (VAULT_LAND_TIMES[i]! - c.start)) - this.slowCells(i) + this.rng.int(0, 3);
      c.seed = this.rng.int(0, 0x7fffffff);
      c.lockedAt = null;
      c.lastCell = NaN;
      c.fitName = "";
      c.moneyFor = NaN;
      this.drawFrame(c);
    });
    this.active = true;
    this.beamsRoot.visible = this.streamRoot.visible = this.labelsRoot.visible = true;
  }

  /** A reload mid-opening: the streams as they were, the beams already landed at rest with their labels. */
  restore(drops: readonly Drop[], landed: number): void {
    this.start(drops);
    for (const c of this.lanes.slice(0, landed)) {
      c.lockedAt = -Infinity;
      this.drawFrame(c);
    }
  }

  /** Off screen: every pooled sprite released. */
  hide(): void {
    this.active = false;
    this.beamsRoot.visible = this.streamRoot.visible = this.labelsRoot.visible = false;
    for (const c of this.lanes) for (const s of c.pool) s.visible = false;
  }

  /** The opening at sim time t: the beams growing in, each stream where it is, the lock-ins' juice playing out. */
  update(t: number): void {
    if (!this.active) return;
    this.t = t;
    const cues = vaultCues(t);
    for (let i = 0; i < N; i++) {
      const c = this.lanes[i]!;
      const b = c.geo;
      if (!b) continue;
      const come = cues.columnIn[i]!;
      c.beam.visible = come > 0;
      c.beam.alpha = come;
      c.beam.scale.y = come;
      const since = c.lockedAt === null ? Infinity : t - c.lockedAt;
      const flash = Math.max(0, 1 - since / FLASH_SECONDS);
      c.core.alpha = CORE_ALPHA + (c.lockedAt === null ? 0 : CORE_LIT) + 0.4 * flash + 0.4 * this.glow;
      c.flash.alpha = Math.max(this.glow, flash);
      this.placeStream(c, i, b, t, b.length * come, since);
      this.placeLabels(c, b, c.lockedAt === null ? 0 : Math.min(1, since / FADE_SECONDS));
    }
    const last = this.lanes[N - 1]!;
    this.halo.visible = last.lockedAt !== null && last.reward.visible;
    this.halo.position.copyFrom(last.reward.position);
    this.halo.alpha = 0.5 + 0.2 * Math.sin(t * 4) + 0.3 * this.glow;
  }

  /** Beam `index` locks in (and pays): a scale pulse, its rarity frame and a gold flash, a star burst and a
   *  chime a whole tone higher than the last; the fifth, the animated ★, gets the halo, a bigger burst, the
   *  choir, a firework kick and a shake. */
  landed(index: number, d: Drop, amount: number): void {
    const c = this.lanes[index];
    if (!c) return;
    c.lockedAt = this.t;
    c.amount = amount;
    this.drawFrame(c);
    const { audio, shake } = this.juice;
    const at = c.geo?.spot; // none before the first layout: the sounds still play
    const color = RARITY_INFO[d.rarity].color;
    const last = index === N - 1;
    audio.play("reward-chime", { rate: 2 ** ((2 * index) / 12) });
    if (at) this.scene.firework(at, color, last);
    if (!last) return;
    if (at) this.scene.firework(at, GOLD, true);
    audio.play("legendary-choir");
    audio.play("firework", { gain: 0.8, rate: 0.9 });
    shake.add(0.25);
  }

  destroy(): void {
    for (const root of [this.beamsRoot, this.streamRoot, this.labelsRoot]) root.destroy({ children: true });
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

  /** The reward's rarity and gold frames around its sprite at rest; none until it lands. */
  private drawFrame(c: Lane): void {
    if (c.lockedAt === null || !c.drop) {
      c.frame.clear();
      c.flash.clear();
      return;
    }
    const tex = this.skins.frames(c.drop)[0]!;
    const s = iconScale(tex.width, tex.height, this.icon, this.k);
    drawRewardFrames(c.frame, c.flash, tex.width * s, tex.height * s, s, RARITY_INFO[c.drop.rarity].color);
  }

  /** The stream at sim time t: every item between the mouth and `reach`, scattered across the beam, fading
   *  out after the lock-in; the reward riding out to its spot, pulsing as it lands, the ★ animating. */
  private placeStream(c: Lane, i: number, b: Beam, t: number, reach: number, since: number): void {
    const land = VAULT_LAND_TIMES[i]!;
    const slow = this.slowCells(i);
    const pos = columnMotion(t, c.start, land, c.target, { slowCells: slow });
    const sp = this.spacing;
    const dx = Math.sin(b.angle);
    const dy = -Math.cos(b.angle);
    const fade = c.lockedAt === null ? 1 : Math.max(0, 1 - since / FADE_SECONDS);
    let n = 0;
    if (fade > 0 && c.filler.length) {
      const from = firstVisible(pos, b.spotDist, reach, sp, Math.min(c.target, firstItem(b.spotDist, sp)));
      const to = lastVisible(pos, b.spotDist, sp);
      for (let j = from; j <= to && n < c.pool.length; j++) {
        if (j === c.target) continue;
        const s = c.pool[n++]!;
        const d = itemDistance(pos, j, c.target, sp, b.spotDist);
        const off = (itemJitter(c.seed, j) * beamWidthAt(b, d)) / 3;
        if (isCoin(j, c.target)) this.put(s, this.coins[mod(Math.floor(t * COIN_FPS) + j, this.coins.length)]!, this.coinScale);
        else {
          const tex = this.skins.frames(c.filler[mod(j, c.filler.length)]!)[0]!;
          this.put(s, tex, iconScale(tex.width, tex.height, this.icon, this.k));
        }
        // perpendicular to the beam is (-dy, dx)
        s.position.set(
          Math.round(b.origin.x + dx * d - dy * off - (s.texture.width * s.scale.x) / 2),
          Math.round(b.origin.y + dy * d + dx * off - (s.texture.height * s.scale.y) / 2),
        );
        s.alpha = fade;
      }
    }
    for (let m = n; m < c.pool.length; m++) c.pool[m]!.visible = false;

    const r = c.reward;
    const dist = itemDistance(pos, c.target, c.target, sp, b.spotDist);
    r.visible = !!c.drop && dist >= 0 && dist <= reach;
    const locked = c.lockedAt !== null;
    c.frame.visible = c.flash.visible = r.visible && locked;
    if (c.drop && r.visible) {
      const frames = this.skins.frames(c.drop);
      r.texture = locked ? frames[frameAt((t - land) * 1000, this.skins.fps(c.drop), frames.length)]! : frames[0]!;
      const s = iconScale(frames[0]!.width, frames[0]!.height, this.icon, this.k);
      const w = r.texture.width * s;
      const h = r.texture.height * s;
      const left = Math.round(b.origin.x + dx * dist - w / 2);
      const top = Math.round(b.origin.y + dy * dist - h / 2);
      const pu = locked ? since / PULSE_SECONDS : 1;
      r.scale.set(s * (pu > 0 && pu < 1 ? 1 + POP * Math.sin(Math.PI * pu) : 1));
      r.position.set(left + w / 2, top + h / 2);
      c.frame.position.set(left, top);
      c.flash.position.set(left, top);
    }

    // a tick for each item that passes the spot while it slows down
    const now = Math.round(pos);
    if (now !== c.lastCell && t < land && c.target - pos <= slow && Number.isFinite(c.lastCell))
      this.juice.audio.play("reel-tick", { gain: 0.25, rate: 1 + i * 0.1 });
    c.lastCell = now;
  }

  private put(s: Sprite, tex: Texture, scale: number): void {
    s.texture = tex;
    s.scale.set(scale);
    s.visible = true;
  }

  /** The name (one line, shrunk to fit its box) over the +$, in the beam's label box, fading in. */
  private placeLabels(c: Lane, b: Beam, alpha: number): void {
    const on = alpha > 0 && !!c.drop;
    c.name.visible = c.money.visible = c.back.visible = on;
    if (!c.drop || !on) return;
    const name = skinName(c.drop.id);
    const box = b.label;
    if (c.fitName !== name || c.fitW !== box.w) {
      const base = box.h / 2;
      const fit = fitLabel([name], box.w, 1, base, base * LABEL_MIN_SHARE);
      c.name.style.fontSize = fit.size;
      c.name.text = fit.lines.join("\n");
      c.name.style.fill = RARITY_INFO[c.drop.rarity].color;
      c.fitName = name;
      c.fitW = box.w;
      c.moneyFor = NaN; // the language may have changed with the name
    }
    if (c.moneyFor !== c.amount) {
      c.money.text = `+${formatCash(c.amount, getLang())}`;
      c.moneyFor = c.amount;
    }
    c.name.alpha = c.money.alpha = c.back.alpha = alpha;
    const x = Math.round(box.x + box.w / 2);
    const line = box.h / 2;
    c.name.position.set(x, Math.round(box.y + (line - c.name.style.fontSize) / 2));
    c.money.position.set(x, Math.round(box.y + line));
  }
}
