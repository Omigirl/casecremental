import type { Renderer } from "pixi.js";
import { getLang } from "../../i18n/index";
import { caseById, skinById } from "../../sim/content/cases";
import { formatCash } from "../../sim/format";
import { RARITY_INFO } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import type { RunState } from "../../sim/run";
import { VAULT_LAND_TIMES } from "../../sim/tuning";
import type { Drop } from "../../sim/types";
import type { Juice } from "../juice/juice";
import type { TableLayout } from "../pixel/layout";
import { PixelLayer } from "../pixel/PixelLayer";
import type { SpriteSet } from "../pixel/sprites";
import type { PixelViewport } from "../pixel/viewport";
import type { SkinTextures } from "../skins/pixelSkin";
import { VAULT_CUE_TIMES } from "./cues";
import { StackedReels, stackRects } from "./stackedReels";
import { vaultReelArea, type VaultScene } from "./VaultScene";

// Vault Case I's five reels: stacked in a pixel layer of their own inside the vault scene, each spinning from
// the moment they come in until its landing time, and each landing louder than the last; the fifth is the
// legendary, shown with the knife's b-roll showcase.

type Opening = Extract<NonNullable<RunState["vault"]>, { phase: "opening" }>;

export class VaultReels {
  private readonly pixel = new PixelLayer();
  private readonly reels: StackedReels;
  private l: TableLayout | null = null;
  private k = 1;

  constructor(
    frameSet: SpriteSet,
    private readonly skins: SkinTextures,
    private readonly scene: VaultScene,
    private readonly juice: Juice,
    /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
    private readonly rng: Rng,
  ) {
    this.reels = new StackedReels(frameSet, skins, (i) => juice.audio.play("reel-tick", { gain: 0.3, rate: 1 + i * 0.1 }));
    this.pixel.world.addChild(this.reels);
    this.reels.visible = false;
    scene.reelSlot.addChild(this.pixel.view);
  }

  layout(l: TableLayout, vp: PixelViewport): void {
    this.l = l;
    this.k = vp.scale;
    this.pixel.resize(vp);
    this.reels.layout(stackRects(vaultReelArea(l), VAULT_LAND_TIMES.length));
  }

  set tint(t: number) {
    this.reels.tint = t;
  }

  start(drops: readonly Drop[]): void {
    // never caseById on a vault drop (its case is "vault1"): the strips are the top case's skins
    const top = caseById("bedrock");
    drops.forEach((d, i) => this.reels.start(i, top, skinById(d.skinId), this.rng));
    this.reels.visible = true;
  }

  hide(): void {
    this.reels.visible = false;
  }

  /** Each reel spins from the moment they come in until its landing time, then stays landed. */
  update(opening: Opening | null): void {
    if (!opening) return;
    for (let i = 0; i < VAULT_LAND_TIMES.length; i++) {
      const fullDuration = VAULT_LAND_TIMES[i]! - VAULT_CUE_TIMES.reels;
      const elapsed = Math.min(fullDuration, Math.max(0, opening.t - VAULT_CUE_TIMES.reels));
      this.reels.update(i, { elapsed, fullDuration, crawl: i === VAULT_LAND_TIMES.length - 1 ? 2.5 : 0.8 });
    }
  }

  render(renderer: Renderer): void {
    if (this.reels.visible) this.pixel.render(renderer, true);
  }

  /** A vault reel lands (and pays): each one louder than the last; the fifth is the legendary, shown with the
   *  knife's b-roll showcase, its animated texture playing as it turns. */
  landed(index: number, d: Drop, amount: number): void {
    const { audio, shake, hd } = this.juice;
    const k = this.k;
    const r = this.l ? stackRects(vaultReelArea(this.l), VAULT_LAND_TIMES.length)[index] : undefined;
    if (!r) return;
    const at = { x: (r.x + r.w / 2) * k, y: (r.y + r.h / 2) * k };
    const last = index === VAULT_LAND_TIMES.length - 1;
    const color = RARITY_INFO[d.rarity].color;
    audio.play("vault-reel-land", { rate: 1 + index * 0.08 });
    audio.play("firework", { gain: 0.6, rate: 1.1 + index * 0.05, delay: 0.05 });
    this.scene.firework(at, color, last);
    this.scene.floatText({ x: at.x, y: at.y - r.h * k * 0.6 }, `+${formatCash(amount, getLang())}`);
    shake.add(0.25 + index * 0.08);
    if (!last) return;
    audio.play("legendary-choir");
    hd.flash(0xffd700, 0.9);
    const skin = skinById(d.skinId); // VAULT_LEGEND (never caseById on it)
    this.scene.showcase(
      this.skins.frames(skin),
      at,
      k,
      () => {
        shake.add(0.3);
        audio.play("coin-clink", { rate: 0.75 });
        this.scene.firework(at, 0xffd700, true);
      },
      skin.motion?.fps ?? 8,
    );
  }

  destroy(): void {
    this.pixel.destroy();
  }
}
