import { Container } from "pixi.js";
import type { BotState } from "../../sim/botOpener";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import type { TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// The bot at its station (rework spec §1): asleep until woken; awake, it hops each time it opens a case on its reel.

export class BotSprite {
  readonly root = new Container();
  private readonly sleep: Animated;
  private readonly awake: Animated;

  constructor(lib: SpriteLibrary) {
    this.sleep = new Animated(new Actor(lib.get("bot-sleep", { w: 51, h: 62, frames: 4 })), ANIMS.botSleep);
    this.awake = new Animated(new Actor(lib.get("bot-open", { w: 51, h: 62, frames: 8 })), ANIMS.botIdle);
    this.root.addChild(this.sleep.actor, this.awake.actor);
  }

  layout(l: TableLayout): void {
    this.sleep.actor.place(l.bot.spot.x, l.bot.spot.y);
    this.awake.actor.place(l.bot.spot.x, l.bot.spot.y);
  }

  /** The wake-up: a stretch and a hop (the station reveal). */
  wake(): void {
    this.awake.play(ANIMS.botWake);
  }

  /** It opens a case on its reel: the crouch-and-hop. */
  open(): void {
    this.awake.play(ANIMS.botOpen);
  }

  update(ms: number, bot: BotState): void {
    this.sleep.actor.visible = !bot.awake;
    this.awake.actor.visible = bot.awake;
    (bot.awake ? this.awake : this.sleep).update(ms);
  }
}
