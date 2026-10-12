import { caseById } from "../../sim/content/cases";
import { RARITY_ORDER } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import { bestSlot } from "../pixel/BenchCards";
import { BotReels } from "../pixel/BotReels";
import { BotSprite } from "../pixel/BotSprite";
import { CardStation } from "../pixel/CardStation";
import { botRevealSpots, type TableLayout } from "../pixel/layout";
import type { RestorePlan } from "../restore";
import type { StationDeps } from "./deps";

// The bot's station (spec §4): its reel window (two stacked reels for a double spin), the bot hopping as it opens, and
// its cards side by side — each sold by hand (drag or tap: the combo) or left for the auto-seller.

export class BotStation {
  readonly sprite: BotSprite;
  readonly reels: BotReels;
  readonly cards: CardStation;

  constructor(private readonly d: StationDeps) {
    this.sprite = new BotSprite(d.lib);
    // its second reel ticks more quietly, so a double spin never sounds like a doubled click
    this.reels = new BotReels(d.reelFrame, d.skins, (i) => d.juice.audio.play("reel-tick", { gain: i === 0 ? 0.35 : 0.18, rate: 1.2 }));
    this.cards = new CardStation(
      {
        spot: "bot",
        spots: botRevealSpots,
        sell: (slot) => ({ type: "sellBot", slot }),
        burst: () => ({ count: 18, speed: (160 * d.scale()) / 6 }),
      },
      d,
    );
  }

  layout(l: TableLayout): void {
    this.sprite.layout(l);
    this.reels.layout(l);
    this.cards.layout(l);
  }

  update(dt: number, ms: number, s: RunState): void {
    this.sprite.update(ms, s.bot);
    this.reels.setOnline(s.bot.awake);
    this.reels.update(s.bot.spin);
    this.cards.update(ms, dt, s.bot.cards);
  }

  /** A fresh World or a new run: its reels where the sim is, or one idle Boot Camp reel. */
  restore(plan: RestorePlan): void {
    const r = plan.botReels;
    if (r) return this.reels.start(r.caseId, r.skinIds, this.d.rng, r.landed);
    const first = caseById("bootcamp");
    this.reels.start(first.id, [this.d.rng.pick(first.skins).id], this.d.rng);
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    switch (e.type) {
      case "botWoke":
        this.sprite.wake();
        hd.flash(0xffd28a, 0.15); // the station's lamp flickers on
        audio.play("bot-wake");
        break;
      case "botUpgraded":
        audio.play("bot-servo", { rate: 1.2 });
        break;
      case "botMultiBought":
        audio.play("bot-servo", { rate: 0.9 });
        audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "botSpinStarted":
        this.sprite.open();
        this.reels.start(
          e.caseId,
          e.drops.map((x) => x.skinId),
          this.d.rng,
        );
        audio.play("bot-reel-spin");
        break;
      case "botRevealed": {
        this.cards.revealed(e.drops);
        const best = e.drops[bestSlot(e.drops) ?? 0];
        if (best) audio.play("reveal-chime", { gain: 0.5, rate: 2 ** (RARITY_ORDER.indexOf(best.rarity) / 6) });
        break;
      }
    }
  }
}
