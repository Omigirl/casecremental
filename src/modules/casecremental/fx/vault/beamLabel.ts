import { Container, Graphics, Text } from "pixi.js";
import { skinName } from "../../i18n/content";
import { getLang } from "../../i18n/index";
import { formatCash } from "../../sim/format";
import { RARITY_INFO } from "../../sim/rarity";
import type { SkinDef } from "../../sim/types";
import { moneyStyle, pixelStyle } from "../hd/font";
import { setLabelLine } from "./beamArt";
import type { Beam } from "./beams";

// A vault reward's label (spec 2026-10-09 §5): its skin name in its rarity's colour over its +$, each one line
// shrunk to fit the beam's label box (cut short with "…" past the floor), on a dark plaque with headroom under the
// +$. Refitted only when the name, the box or the amount changes, never per frame.

const LABEL_BACK = 0x07080c;

export class RewardLabel {
  readonly back = new Graphics();
  readonly name = new Text({ text: "", style: pixelStyle(8, 0xffffff), anchor: { x: 0.5, y: 0 } });
  readonly money = new Text({ text: "", style: moneyStyle(8), anchor: { x: 0.5, y: 0 } });
  /** What the lines were last set for. */
  private fitName = "";
  private fitW = 0;
  private moneyFor = NaN;

  constructor(into: Container) {
    Object.assign(this.name.style, { wordWrap: false, align: "center" });
    into.addChild(this.back, this.name, this.money);
  }

  /** A new layout: the plaque redrawn, both lines refitted on their next show. */
  layout(b: Beam): void {
    const { x, y, w, h } = b.plaque;
    this.back.clear().rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).fill({ color: LABEL_BACK, alpha: 0.7 });
    this.reset();
  }

  /** A new opening: both lines refitted on their next show. */
  reset(): void {
    this.fitName = "";
    this.moneyFor = NaN;
  }

  /** The label for `drop` paying `amount` in beam `b`'s box, at `alpha` (hidden at 0 or without a drop). */
  place(drop: SkinDef | null, amount: number, b: Beam, alpha: number): void {
    const on = alpha > 0 && !!drop;
    this.name.visible = this.money.visible = this.back.visible = on;
    if (!drop || !on) return;
    const name = skinName(drop.id);
    const box = b.label;
    const line = b.font;
    if (this.fitName !== name || this.fitW !== box.w) {
      setLabelLine(this.name, name, box.w, line);
      this.name.style.fill = RARITY_INFO[drop.rarity].color;
      this.fitName = name;
      this.fitW = box.w;
      this.moneyFor = NaN; // the language may have changed with the name
    }
    if (this.moneyFor !== amount) {
      setLabelLine(this.money, `+${formatCash(amount, getLang())}`, box.w, line);
      this.moneyFor = amount;
    }
    this.name.alpha = this.money.alpha = this.back.alpha = alpha;
    const x = Math.round(box.x + box.w / 2);
    // each centred in its line: the +$ a line down, the plaque's headroom under it
    this.name.position.set(x, Math.round(box.y + (line - this.name.style.fontSize) / 2));
    this.money.position.set(x, Math.round(box.y + line + (line - this.money.style.fontSize) / 2));
  }
}
