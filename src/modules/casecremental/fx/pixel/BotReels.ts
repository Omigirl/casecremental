import type { BotSpin } from "../../sim/botOpener";
import { caseById, skinById } from "../../sim/content/cases";
import type { Rng } from "../../sim/rng";
import type { SkinTextures } from "../skins/pixelSkin";
import { StackedReels, stackRects } from "../vault/stackedReels";
import { botReelArea, type TableLayout } from "./layout";
import type { SpriteSet } from "./sprites";

// The bot's reel window (spec §4): one reel, or — for a double spin (Run 2+) — two stacked in a window that reaches
// down to just above its cards' spot. Every reel lands with the spin (the bot never teases). None in portrait.

/** The tallest one reel gets in the bot's stack. */
const REEL_MAX_H = 26;
/** A reel shown already stopped (a reload while its cards wait). */
const LANDED = { elapsed: 1, fullDuration: 1, crawl: 0 };

export class BotReels {
  readonly root: StackedReels;
  private l: TableLayout | null = null;
  private n = 1;
  private online = false;
  /** Whether a spin frame was shown: the frame it ends (the sim clears the spin) snaps the reels to their landing. */
  private spun = false;
  /** Ticks are muted while a reload sets the reels straight onto their drops. */
  private quiet = false;
  /** The last spin started: reels made later (a rotation out of portrait, a resize) pick it up. */
  private last: { caseId: string; skinIds: string[]; rng: Rng } | null = null;

  constructor(frameSet: SpriteSet, skins: SkinTextures, onTick: (i: number) => void) {
    this.root = new StackedReels(frameSet, skins, (i) => {
      if (!this.quiet) onTick(i);
    });
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.apply();
  }

  /** The reels show once the bot is awake (and there is a window for them). */
  setOnline(on: boolean): void {
    if (on === this.online) return;
    this.online = on;
    this.apply();
  }

  /** A new spin (or a reload): one reel per case, each landing on its skin; `landed`: already stopped there. */
  start(caseId: string, skinIds: readonly string[], rng: Rng, landed = false): void {
    this.last = { caseId, skinIds: [...skinIds], rng };
    this.spun = false;
    const n = Math.max(1, skinIds.length);
    if (n !== this.n) {
      this.n = n;
      this.apply();
    }
    this.spin(landed);
  }

  update(spin: BotSpin | null): void {
    if (!spin) {
      if (this.spun) for (let i = 0; i < this.n; i++) this.root.land(i);
      this.spun = false;
      return;
    }
    this.spun = true;
    for (let i = 0; i < this.n; i++) this.root.update(i, { elapsed: spin.elapsed, fullDuration: spin.duration, crawl: 0 });
  }

  private apply(): void {
    const area = this.l ? botReelArea(this.l, this.n) : null;
    this.root.visible = this.online && !!area;
    if (!area) return;
    const made = this.root.count;
    this.root.layout(stackRects(area, this.n, REEL_MAX_H));
    // new reels were never started: set them on the last spin's drops (a spin under way moves on with update)
    if (this.root.count > made) this.spin(true);
  }

  /** Each reel onto the last spin's skins, or already stopped there (quietly). */
  private spin(landed: boolean): void {
    const r = this.last;
    if (!r) return;
    const c = caseById(r.caseId);
    r.skinIds.forEach((id, i) => this.root.start(i, c, skinById(id), r.rng));
    if (!landed) return;
    this.quiet = true;
    r.skinIds.forEach((_, i) => this.root.update(i, LANDED));
    this.quiet = false;
  }
}
