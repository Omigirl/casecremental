import { Container, Graphics } from "pixi.js";
import { botSpeed, type BotState } from "../../sim/botSeller";
import { RARITY_INFO } from "../../sim/rarity";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import { botStations, botTarget, stepToward, type BotStations } from "./botPath";
import type { Pt, TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// The bot on the table (M2b spec §3): asleep at its station until woken; then it walks along the table
// front in whole-pixel steps, carries the card over its head to the SELL bin or the claim tray, and walks
// back. Its leg and its card come from the sim's bot state every frame, so a reload puts it where it was.

/** A footstep every this many ms (the bob). */
const STEP_MS = 120;
const CARD = { w: 10, h: 7 };
/** The bot's drawn height (art targetH); its sprite frame has headroom above it. */
const BOT_H = 48;

export class BotSprite {
  readonly root = new Container();
  private readonly sleep: Animated;
  private readonly awake: Animated;
  private readonly card = new Graphics();
  private st: BotStations | null = null;
  private x = 0;
  private facing: 1 | -1 = 1;
  private walkMs = 0;
  private frenzy = false;

  constructor(lib: SpriteLibrary) {
    this.sleep = new Animated(new Actor(lib.get("bot-sleep", { w: 51, h: 62, frames: 4 })), ANIMS.botSleep);
    this.awake = new Animated(new Actor(lib.get("bot-open", { w: 51, h: 62, frames: 8 })), ANIMS.botIdle);
    this.card.visible = false;
    this.root.addChild(this.sleep.actor, this.awake.actor, this.card);
  }

  layout(l: TableLayout): void {
    const first = this.st === null;
    this.st = botStations(l);
    if (first) this.x = this.st.home;
    this.sleep.actor.place(this.st.home, this.st.y);
  }

  /** Above its head, in world px (the "tray full" text sits here). */
  head(): Pt {
    return { x: Math.round(this.x), y: (this.st?.y ?? 0) - BOT_H - 4 };
  }

  /** The wake-up: a stretch and a hop (the station reveal). */
  wake(): void {
    this.awake.play(ANIMS.botWake);
  }

  /** The vault finale: it can't stand still. */
  setFrenzy(on: boolean): void {
    if (on === this.frenzy) return;
    this.frenzy = on;
    this.awake.setIdle(on ? ANIMS.botFrenzy : ANIMS.botIdle);
  }

  update(ms: number, bot: BotState): void {
    const st = this.st;
    if (!st) return;
    this.sleep.actor.visible = !bot.awake;
    this.awake.actor.visible = bot.awake;
    if (!bot.awake) {
      this.x = st.home;
      this.facing = 1;
      this.card.visible = false;
      this.mirror(st.home);
      this.sleep.update(ms);
      return;
    }
    const target = botTarget(st, bot.job, botSpeed(bot.speedLevel));
    const before = this.x;
    this.x = stepToward(this.x, target.x, (target.pxPerSec * ms) / 1000);
    const moving = this.x !== before;
    if (moving) this.facing = this.x < before ? -1 : 1;
    this.walkMs = moving ? this.walkMs + ms : 0;
    const bob = moving && Math.floor(this.walkMs / STEP_MS) % 2 === 1 ? -1 : 0;
    const x = Math.round(this.x);
    this.awake.actor.place(x, st.y + bob);
    this.awake.update(ms);
    const drop = bot.job?.drop ?? null;
    this.card.visible = !!drop;
    if (drop) {
      const top = st.y + bob - BOT_H - CARD.h + 2;
      const left = x - CARD.w / 2;
      this.card
        .clear()
        .rect(left, top, CARD.w, CARD.h)
        .fill({ color: 0x120e10 })
        .rect(left + 1, top + 1, CARD.w - 2, CARD.h - 2)
        .fill({ color: RARITY_INFO[drop.rarity].color });
    }
    this.mirror(x);
  }

  /** The sheet faces right; walking left mirrors the bot (and its card) around its own feet. */
  private mirror(x: number): void {
    this.root.pivot.x = x;
    this.root.x = x;
    this.root.scale.x = this.facing;
  }
}
