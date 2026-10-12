import { GlitchFilter } from "pixi-filters";
import type { Container } from "pixi.js";
import { caseById } from "../../sim/content/cases";
import { vaultFor } from "../../sim/content/vaults";
import type { Rng } from "../../sim/rng";
import type { Run } from "../../sim/run";
import type { CaseDef, SkinDef } from "../../sim/types";
import type { HdLayer } from "../hd/HdLayer";
import { finaleSpin, TEAR_OFFSET, tearAt } from "./finaleRules";
import { vaultLook } from "./vaultLooks";

// The Last Case's two extras (finish spec §7.4), driven from the sim every frame: the screen tear (a GlitchFilter on
// the scene and the vault, off outside its window) and the table's reels spinning until the lid opens. Both read the
// vault's clock, so a reload lands on the same frame: mid-tear it carries on to the end of its window (the impact is
// not replayed), mid-intro the reels pick up their spin where the clock is. Ordinary vaults never touch either.

/** The most reels the bot stacks (Run 4's x3): the free spin hands it one skin each, and it takes what it shows. */
const BOT_REELS_MAX = 3;
/** GlitchFilter's fill mode for the gap a slice leaves: wrap the picture around (no black bars, no brightness change). */
const FILL_LOOP = 2;

/** What the finale asks of your bench's reels (BenchReels). */
export interface FinaleBench {
  freeSpin(c: CaseDef, winner: SkinDef, rng: Rng, start: boolean, elapsed: number, duration: number): void;
}

/** What the finale asks of the bot's reels (Stations). */
export interface FinaleBot {
  finaleSpin(caseId: string, skinIds: readonly string[], start: boolean, elapsed: number, duration: number): void;
}

export class Finale {
  /** Slices offset sideways with a 3 px colour split: no inversion, no brightness change. */
  private readonly tear = new GlitchFilter({ slices: 10, offset: 0, fillMode: FILL_LOOP, red: [3, 0], blue: [-3, 0] });
  private readonly targets: Container[];
  private slot = -1;
  /** Whether last frame drove the reels (the first frame of the intro, or the first after a reload, starts them). */
  private spinning = false;

  constructor(
    targets: Container[],
    private readonly hd: HdLayer,
    private readonly rng: Rng,
    private readonly bench: FinaleBench,
    private readonly bot: FinaleBot,
  ) {
    this.targets = targets;
    this.tear.enabled = false;
    for (const c of targets) c.filters = [...(c.filters ?? []), this.tear];
  }

  update(run: Run, k: number): void {
    const s = run.state;
    const def = vaultFor(run.setup.run);
    const finale = vaultLook(def.id).finale;
    const tear = finale && s.vault?.phase === "opening" ? tearAt(s.vault.t) : null;
    this.tear.enabled = tear !== null;
    if (tear) {
      this.tear.offset = Math.round(((TEAR_OFFSET * k) / 4) * tear.strength);
      // a new slice pattern at most 3 times a second, and only when the flash gate allows (a refusal holds them)
      if (tear.slot !== this.slot && this.hd.takeFlash()) {
        this.tear.seed = this.rng.next();
        this.tear.refresh();
        this.slot = tear.slot;
      }
    } else this.slot = -1;
    const spin = finaleSpin(s.vault, finale);
    const c = caseById(def.sourceCase);
    if (spin) {
      const start = !this.spinning;
      const skins = start ? Array.from({ length: BOT_REELS_MAX }, () => this.rng.pick(c.skins).id) : [];
      this.bench.freeSpin(c, this.rng.pick(c.skins), this.rng, start, spin.elapsed, spin.duration);
      this.bot.finaleSpin(c.id, skins, start, spin.elapsed, spin.duration);
    } else if (this.spinning) {
      // the lid opened between two frames: every reel lands on it (the last frame never shows fraction 1)
      this.bench.freeSpin(c, c.skins[0]!, this.rng, false, 1, 1);
      this.bot.finaleSpin(c.id, [], false, 1, 1);
    }
    this.spinning = spin !== null;
  }

  destroy(): void {
    for (const c of this.targets) c.filters = (c.filters ?? []).filter((f) => f !== this.tear);
    this.tear.destroy();
  }
}
