import type { Container } from "pixi.js";
import { skinById } from "../sim/content/cases";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import type { Bench as BenchState } from "../sim/run";
import type { Drop, SkinDef } from "../sim/types";
import { KnifeFlight } from "./hd/knifeFlight";
import { bigReveal } from "./juice/bigReveal";
import type { Juice } from "./juice/juice";
import type { Bench } from "./pixel/Bench";
import { bestSlot, knifeSlot } from "./pixel/BenchCards";
import type { Pt } from "./pixel/layout";
import type { SkinTextures } from "./skins/pixelSkin";

// Your bench's reveal and sale juice (multi-open: one card per case, side by side). Each card gets its own
// spark burst; the once-only effects — the glow, the chime, hit-stop, zoom, shake, the Covert impact, the
// ducking and the ★ sequence — play once, for the best card. The ★ knife's b-roll flies from the first card
// whose skin flips, and only one knife flies at a time.

/** Sparks per rarity: how many, and how fast (tuned at pixel scale 6, 1080p). */
const BURST: Record<Drop["rarity"], { count: number; speed: number }> = {
  milspec: { count: 10, speed: 140 },
  restricted: { count: 24, speed: 220 },
  classified: { count: 45, speed: 300 },
  covert: { count: 90, speed: 420 },
  gold: { count: 220, speed: 520 },
};

/** A card's sparks at pixel scale `scale`: as many as its rarity throws, at its speed scaled from 6. */
export function cardBurst(rarity: Drop["rarity"], scale: number): { count: number; speed: number } {
  const b = BURST[rarity];
  return { count: b.count, speed: (b.speed * scale) / 6 };
}

/** The glow under the cards: the best one still waiting's colour, or null (out) when none waits. */
export function glowColor(cards: readonly (Drop | null)[]): number | null {
  const best = bestSlot(cards);
  return best === null ? null : RARITY_INFO[cards[best]!.rarity].color;
}

export class BenchFx {
  private readonly knifeFlight: KnifeFlight;

  constructor(
    private readonly bench: Bench,
    private readonly juice: Juice,
    private readonly skins: SkinTextures,
    /** The pixel scale now (it changes on resize). */
    private readonly scale: () => number,
    parent: Container,
  ) {
    this.knifeFlight = new KnifeFlight(parent);
  }

  update(realSeconds: number): void {
    this.knifeFlight.update(realSeconds);
  }

  /** Your bench's ★ knife showcase is in the air. */
  get knifeFlying(): boolean {
    return this.knifeFlight.flying;
  }

  /** A reel lands before its teasing partner: its own quieter stop and a small shake (the last is revealed()'s). */
  reelLanded(): void {
    this.juice.shake.add(0.05);
    this.juice.audio.play("reel-stop", { gain: 0.35 });
  }

  /** The reels land and the cards come up. */
  revealed(drops: readonly Drop[]): void {
    const { hd, audio, shake } = this.juice;
    shake.add(0.12); // the reel lands
    audio.play("reel-stop", { gain: 0.6 });
    const v = this.scale() / 6; // spark speeds were tuned at scale 6 (1080p)
    drops.forEach((d, i) => this.bench.showReveal(i, skinById(d.skinId), d));
    const knife = knifeSlot(drops, (d) => skinById(d.skinId).motion?.weapon === "flip");
    if (knife !== null) this.launchKnife(knife, skinById(drops[knife]!.skinId), v);
    const best = drops[bestSlot(drops) ?? 0];
    if (!best) return;
    const color = RARITY_INFO[best.rarity].color;
    hd.setGlow(color);
    audio.play("reveal-chime", { rate: 2 ** (RARITY_ORDER.indexOf(best.rarity) / 6) });
    drops.forEach((d, i) => {
      const b = cardBurst(d.rarity, this.scale());
      hd.particles.burst(this.at(i), RARITY_INFO[d.rarity].color, b.count, b.speed);
    });
    bigReveal(this.juice, best.rarity, true);
  }

  /** Redraw the cards still waiting after a reload (no juice). */
  restore(cards: readonly (Drop | null)[]): void {
    cards.forEach((d, i) => {
      if (d) this.bench.showReveal(i, skinById(d.skinId), d);
    });
    this.glowFor(cards);
  }

  /** A bench card leaves (sold, taken by the auto-seller, or stored). The knife's own card takes its flight
   *  with it; the glow follows the best card left and goes out with the last one. */
  left(slot: number, sold: boolean, b: BenchState): void {
    if (this.bench.knifeOut === slot) this.knifeFlight.cancel();
    this.bench.clearReveal(slot, sold);
    this.glowFor(b.phase === "revealed" ? b.cards : []);
  }

  /** The screen changed, the vault slammed in, or the run ended: a knife in the air goes straight back. */
  cancelKnife(): void {
    if (!this.knifeFlight.flying) return;
    this.knifeFlight.cancel();
    this.bench.endKnifeFlight();
  }

  /** Every card leaves at once (a new run). */
  clearAll(): void {
    this.knifeFlight.cancel();
    this.bench.clearAll();
    this.juice.hd.setGlow(null);
  }

  private glowFor(cards: readonly (Drop | null)[]): void {
    this.juice.hd.setGlow(glowColor(cards));
  }

  /** A card's centre on screen. */
  private at(slot: number): Pt {
    return this.juice.hd.toScreen(this.bench.cardCentre(slot));
  }

  /** The ★ knife's b-roll shot: it comes out of the card toward the viewer, turns, and settles back in. */
  private launchKnife(slot: number, skin: SkinDef, v: number): void {
    const at = this.at(slot);
    this.bench.beginKnifeFlight(slot);
    this.knifeFlight.start(this.skins.frames(skin)[0]!, at, this.scale(), () => {
      this.bench.endKnifeFlight();
      this.juice.shake.add(0.3);
      this.juice.audio.play("coin-clink", { rate: 0.75 });
      this.juice.hd.particles.burst(at, 0xffd700, 50, 260 * v);
    });
  }
}
