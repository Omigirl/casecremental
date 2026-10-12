import { Container, Graphics, Text } from "pixi.js";
import { getLang, t } from "../../i18n/index";
import { RARITY_INFO } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import { UPGRADER_SPIN_SECONDS } from "../../sim/tuning";
import type { RarityId } from "../../sim/types";
import { pixelStyle } from "../hd/font";
import type { Pt, TableLayout } from "../pixel/layout";
import type { StationDeps } from "./deps";
import { lampFontSize } from "./lockerRules";
import { DIAL_R, DIAL_SECTORS, dialAlpha, dialCentre, dialTexts, needleAngle, ticksCrossed, winArc } from "./upgraderRules";

// The Upgrader's dial over the locker (finish spec §7.2, HD layer): a dark disc, the win arc in gold from the top for
// the chance, the rest dark red, the stake's pips round the rim, the target and the chance under it, and a white
// needle that turns three times and eases onto the roll. Drawn from the sim's spin every frame, so a reload resumes at
// the same angle and its first frame ticks nothing. Events are one-shot juice: the press closing on the stake at GO;
// at the landing a win's float (the card's pop is the locker's own) or the loss's shred. Then it fades. Nothing here
// pulses or flashes.

const DISC = 0x14101a;
const WIN = 0xffd34d;
const LOSE = 0x5a1414;
const NEEDLE = 0xffffff;
const MARK = 0x2a2230;
const DIM = 0xa89a8c;
const SHRED_TINT = 0xd05050;
/** Pips round the rim, one per staked skin, at most this many. */
const PIPS_MAX = 10;
const TAU = Math.PI * 2;

/** What the dial shows: the spin while it runs, kept for the fade after it lands. */
interface Face {
  mult: number;
  chance: number;
  pips: RarityId[];
  roll: number;
  angle: number;
}

export class UpgraderDial {
  readonly hd = new Container();
  private readonly g = new Graphics();
  private readonly mult = new Text({ text: "", style: pixelStyle(8, WIN) });
  private readonly chance = new Text({ text: "", style: pixelStyle(8, DIM) });
  private l: TableLayout | null = null;
  private face: Face | null = null;
  private lastAngle: number | null = null;
  private sinceDone = Infinity;

  constructor(private readonly d: StationDeps) {
    this.mult.anchor.set(0.5, 0);
    this.chance.anchor.set(0.5, 0);
    this.hd.addChild(this.g, this.mult, this.chance);
    this.hd.visible = false;
  }

  layout(l: TableLayout): void {
    this.l = l;
    const size = lampFontSize(this.d.scale());
    this.mult.style.fontSize = this.chance.style.fontSize = size;
  }

  update(dt: number, s: RunState): void {
    this.sinceDone += dt;
    const spin = s.upgrader.spin;
    if (spin) {
      const angle = needleAngle(spin);
      const n = ticksCrossed(this.lastAngle, angle);
      if (n > 0) this.d.juice.audio.play("reel-tick", { rate: 1.4, gain: 0.5 }); // at most one a frame
      this.lastAngle = angle;
      this.face = {
        mult: spin.mult,
        chance: spin.chance,
        pips: spin.inputs.slice(0, PIPS_MAX).map((x) => x.rarity),
        roll: spin.roll,
        angle,
      };
    } else this.lastAngle = null;
    const alpha = dialAlpha(spin !== null, this.sinceDone);
    this.hd.visible = alpha > 0 && this.face !== null && this.l !== null;
    if (!this.hd.visible || !this.face || !this.l) return;
    this.hd.alpha = alpha;
    this.draw(this.face, this.d.juice.hd.toScreen(dialCentre(this.l.locker)), this.d.scale());
  }

  onEvent(e: SimEvent): void {
    const { hd, audio, shake } = this.d.juice;
    switch (e.type) {
      case "upgraderStarted":
        audio.play("tradeup-press", { rate: 1.2, gain: 0.7 }); // the press closes on the stake
        this.lastAngle = 0;
        this.sinceDone = Infinity;
        break;
      case "upgraderDone": {
        this.sinceDone = 0;
        if (this.face) this.face.angle = landedAngle(this.face.roll); // the sim ends the spin before a frame shows its end
        if (!this.l) break;
        const at = hd.toScreen(dialCentre(this.l.locker));
        const k = this.d.scale();
        if (e.win) hd.coins.floatText({ x: at.x, y: at.y - DIAL_R * k }, t("float.upgraded"));
        else {
          const r = e.inputs[0]?.rarity;
          hd.particles.burst(at, r ? RARITY_INFO[r].color : DIM, 24, (90 * k) / 6, 500); // the stake, shredded
          shake.add(0.15);
          audio.play("upgrader-shred");
          hd.coins.floatText({ x: at.x, y: at.y - DIAL_R * k }, t("float.shredded"), SHRED_TINT);
        }
        break;
      }
      case "runStarted":
        this.face = null;
        this.lastAngle = null;
        this.sinceDone = Infinity;
        break;
    }
  }

  destroy(): void {
    this.g.destroy();
    this.mult.destroy();
    this.chance.destroy();
  }

  private draw(f: Face, c: Pt, k: number): void {
    const R = DIAL_R * k;
    const top = -Math.PI / 2; // clockwise from the top, in Pixi's y-down angles
    const arc = winArc(f.chance);
    const g = this.g.clear();
    g.circle(c.x, c.y, R).fill(DISC);
    g.circle(c.x, c.y, R * 0.88).fill(LOSE);
    if (arc.to > arc.from)
      g.moveTo(c.x, c.y)
        .arc(c.x, c.y, R * 0.88, top + arc.from, top + arc.to)
        .closePath()
        .fill({ color: WIN, alpha: 0.9 });
    for (let i = 0; i < DIAL_SECTORS; i++) {
      const a = top + (i / DIAL_SECTORS) * TAU;
      g.moveTo(c.x + Math.cos(a) * R * 0.72, c.y + Math.sin(a) * R * 0.72)
        .lineTo(c.x + Math.cos(a) * R * 0.88, c.y + Math.sin(a) * R * 0.88)
        .stroke({ width: Math.max(1, k / 4), color: MARK });
    }
    g.circle(c.x, c.y, R * 0.42).fill(DISC);
    f.pips.forEach((r, i) => {
      const a = top + ((i + 0.5) / f.pips.length) * TAU;
      g.circle(c.x + Math.cos(a) * R * 1.12, c.y + Math.sin(a) * R * 1.12, Math.max(1, k * 0.7)).fill(RARITY_INFO[r].color);
    });
    const na = top + f.angle;
    g.moveTo(c.x, c.y)
      .lineTo(c.x + Math.cos(na) * R * 0.95, c.y + Math.sin(na) * R * 0.95)
      .stroke({ width: Math.max(1, k * 0.6), color: NEEDLE });
    g.circle(c.x, c.y, Math.max(1, k * 0.9)).fill(NEEDLE);
    const txt = dialTexts(f.mult, f.chance, getLang());
    this.mult.text = txt.mult;
    this.chance.text = txt.chance;
    this.mult.position.set(c.x, c.y + R * 1.25);
    this.chance.position.set(c.x, this.mult.y + this.mult.height);
  }
}

/** The needle's resting angle once the spin has run its course. */
const landedAngle = (roll: number): number => needleAngle({ roll, elapsed: UPGRADER_SPIN_SECONDS });
