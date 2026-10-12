import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { autoSpinStatus } from "../../sim/autoSpin";
import type { RunState, SimEvent } from "../../sim/run";
import { ARM_LAMP, armFrames } from "../pixel/armArt";
import type { Pt, TableLayout } from "../pixel/layout";
import { Throttle } from "../throttle";
import { armFrame, armHit, LAMP_ON, lampColor } from "./autoSpinRules";
import type { StationDeps } from "./deps";

// Auto-spin's arm (finish spec §3): a small motorised lever bolted to your mat's right end, drawn in code. Hidden until
// bought; its lamp and visibility come from the sim every frame, so a reload shows it as it is. Events are only its
// juice: the lever pulls when it buys, the arm swings when it turns the key, and the run's first switch-on is its
// power-on (a green light, sparks, the seller's power-on sound). A tap on it flips the switch. The key swing is
// event-driven and idempotent: a key turned the tick after a hand-bought case just restarts the same 0.3 s swing.

/** The lamp's glow while lit (HD). */
const LAMP_GLOW = 0.6;

export class AutoSpinStation {
  /** The arm and its lamp (pixel world, on the table under your bench's cards). */
  readonly under = new Container();
  /** The lamp's glow (HD). */
  readonly hd = new Container();
  private readonly frames: Texture[] = armFrames();
  private readonly arm = new Sprite();
  private readonly lamp = new Graphics();
  private readonly glow: Sprite;
  private readonly servo = new Throttle(0.15);
  private l: TableLayout | null = null;
  private sincePull = Infinity;
  private sinceKey = Infinity;
  private lampColor = -1;
  private t = 0;

  constructor(private readonly d: StationDeps) {
    this.arm.texture = this.frames[0]!;
    this.glow = new Sprite({ texture: d.juice.hd.glowTexture, anchor: 0.5, blendMode: "add" });
    this.under.addChild(this.arm, this.lamp);
    this.hd.addChild(this.glow);
  }

  layout(l: TableLayout): void {
    this.l = l;
    const r = l.you.arm;
    this.arm.position.set(r.x, r.y);
    this.lamp.position.set(r.x + ARM_LAMP.x, r.y + ARM_LAMP.y);
    const k = this.d.scale();
    this.glow.position.set((r.x + ARM_LAMP.x + ARM_LAMP.w / 2) * k, (r.y + ARM_LAMP.y + ARM_LAMP.h / 2) * k);
    this.glow.width = this.glow.height = 10 * k;
  }

  update(dt: number, s: RunState): void {
    this.t += dt;
    this.sincePull += dt;
    this.sinceKey += dt;
    const owned = s.autoSpin.owned;
    this.under.visible = this.hd.visible = owned;
    if (!owned) return;
    this.arm.texture = this.frames[armFrame(this.sincePull, this.sinceKey)]!;
    const status = autoSpinStatus(this.d.controller.run);
    const color = lampColor(status, this.t);
    if (color !== this.lampColor) {
      this.lampColor = color;
      this.lamp.clear().rect(0, 0, ARM_LAMP.w, ARM_LAMP.h).fill(color);
    }
    this.glow.tint = color;
    this.glow.alpha = status === "off" ? 0 : LAMP_GLOW;
  }

  /** A tap on the arm flips its switch; true when the tap was on it. */
  tap(p: Pt, s: RunState): boolean {
    const r = this.l?.you.arm;
    if (!r || !s.autoSpin.owned || !armHit(r, p)) return false;
    this.d.controller.act({ type: "setAutoSpin", on: !s.autoSpin.on });
    return true;
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    const k = this.d.scale();
    switch (e.type) {
      case "autoSpinBought":
        hd.particles.burst(this.screenCentre(), LAMP_ON, 16, (120 * k) / 6);
        audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "autoSpinUpgraded":
        audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "autoSpinToggled":
        if (e.on && e.first) {
          hd.flash(LAMP_ON, 0.2); // the machine's power-on: once a run, never after a reload
          hd.particles.burst(this.screenCentre(), LAMP_ON, 30, (180 * k) / 6);
          audio.play("seller-power-on");
        } else audio.play("bot-servo", { rate: 1.6, gain: 0.4 });
        break;
      case "autoSpinPulled":
        this.sincePull = 0;
        if (this.servo.ready(this.t)) audio.play("bot-servo", { rate: 1.4, gain: 0.5 });
        break;
      case "autoSpinKeyed":
        this.sinceKey = 0;
        break;
      case "runStarted":
        this.sincePull = this.sinceKey = Infinity;
        break;
    }
  }

  destroy(): void {
    for (const tex of this.frames) tex.destroy(true);
  }

  /** The arm's middle, screen px. */
  private screenCentre(): Pt {
    const r = this.l?.you.arm ?? { x: 0, y: 0, w: 0, h: 0 };
    return this.d.juice.hd.toScreen({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }
}
