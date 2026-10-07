import { Circle, Container, Graphics, Text, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import { skinDisplayName } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import type { Bench } from "../sim/run";
import type { CaseDef, Drop, SkinDef } from "../sim/types";
import { wearOf } from "../sim/wear";
import { makeDraggable } from "./drag";
import { KEY_RADIUS, type Layout, type Point } from "./layout";
import { makeCard } from "./ReelView";

// The bench: the bought case with its lock, the key (drag it into the lock), the revealed skin
// (drag it into the sell bin) and the sell bin. Taps work too. All changes go through controller.act.

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function hintFor(b: Bench, canBrake: boolean): string {
  switch (b.phase) {
    case "empty":
      return "Buy a case below ↓";
    case "locked":
      return "Drag the key into the lock";
    case "spinning":
      return canBrake ? "Click to slam the brakes!" : "";
    case "revealed":
      return "Drag it to SELL →";
  }
}

export class BenchView extends Container {
  private readonly caseBox = new Container();
  private readonly caseBody = new Graphics();
  private readonly caseLabel = new Text({ text: "", style: { fontFamily: FONT, fontSize: 13, fontWeight: "700", fill: 0xffffff } });
  private readonly lock = new Graphics();
  private readonly key = new Graphics();
  private readonly bin = new Container();
  private readonly binBody = new Graphics();
  private readonly binLabel = new Text({ text: "SELL", style: { fontFamily: FONT, fontSize: 16, fontWeight: "900", fill: 0x0b0d12 } });
  private readonly reveal = new Container();
  private readonly hint = new Text({ text: "", style: { fontFamily: FONT, fontSize: 13, fill: 0xc8cbd6 } });
  private l: Layout | null = null;
  private caseColor = 0x4b5320;
  private caseName = "";
  private pop = 1;
  private clock = 0;

  constructor(private readonly controller: GameController) {
    super();
    this.caseLabel.anchor.set(0.5);
    this.binLabel.anchor.set(0.5);
    this.hint.anchor.set(0.5, 0);
    this.caseBox.addChild(this.caseBody, this.caseLabel, this.lock);
    this.bin.addChild(this.binBody, this.binLabel);
    this.addChild(this.caseBox, this.bin, this.reveal, this.key, this.hint);

    this.key
      .circle(-12, 0, 11).fill({ color: 0xffd34d }).stroke({ width: 2, color: 0x8a6d1a })
      .rect(-2, -3, 28, 6).fill({ color: 0xffd34d })
      .rect(18, 3, 4, 6).fill({ color: 0xffd34d })
      .rect(24, 3, 3, 4).fill({ color: 0xffd34d });
    this.key.hitArea = new Circle(0, 0, KEY_RADIUS);

    makeDraggable(this.key, {
      home: () => this.l?.keyHome ?? { x: 0, y: 0 },
      onTap: () => void this.controller.act({ type: "insertKey" }),
      onDrop: (p) => !!this.l && dist(p, this.l.lock) < 70 && this.controller.act({ type: "insertKey" }).ok,
    });
    makeDraggable(this.reveal, {
      home: () => this.l?.bench ?? { x: 0, y: 0 },
      onTap: () => void this.controller.act({ type: "sell" }),
      onDrop: (p) => !!this.l && dist(p, this.l.sellBin) < this.l.sellBin.r + 60 && this.controller.act({ type: "sell" }).ok,
    });
    this.bin.eventMode = "static";
    this.bin.cursor = "pointer";
    this.bin.on("pointertap", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.controller.act({ type: "sell" });
    });
  }

  layout(l: Layout): void {
    this.l = l;
    this.caseBox.position.set(l.bench.x, l.bench.y);
    this.drawCase();
    this.key.position.set(l.keyHome.x, l.keyHome.y);
    this.bin.position.set(l.sellBin.x, l.sellBin.y);
    this.binBody.clear().circle(0, 0, l.sellBin.r).fill({ color: 0x3ddc84 }).stroke({ width: 3, color: 0x1f8f52 });
    this.reveal.position.set(l.bench.x, l.bench.y);
    this.hint.position.set(l.bench.x, l.reel.y + l.reel.h + 4);
  }

  showCase(c: CaseDef): void {
    this.caseColor = Number.parseInt(c.color.slice(1), 16);
    this.caseName = c.name;
    this.drawCase();
    this.pop = 0.6;
  }

  showReveal(skin: SkinDef, drop: Drop): void {
    this.clearReveal();
    if (!this.l) return;
    const { w, h } = this.l.revealSize;
    const card = makeCard(skin, w, h * 0.7);
    card.position.set(-w / 2, -h / 2);
    const name = new Text({
      text: skinDisplayName(skin),
      style: { fontFamily: FONT, fontSize: Math.max(11, w * 0.075), fontWeight: "800", fill: 0xffffff },
    });
    name.anchor.set(0.5, 0);
    name.position.set(0, -h / 2 + h * 0.71);
    const info = new Text({
      text: `${wearOf(drop.float).name}${drop.statTrak ? " · StatTrak™" : ""} · ${formatCash(drop.value)}`,
      style: { fontFamily: FONT, fontSize: Math.max(10, w * 0.06), fill: RARITY_INFO[drop.rarity].color },
    });
    info.anchor.set(0.5, 0);
    info.position.set(0, -h / 2 + h * 0.86);
    this.reveal.addChild(card, name, info);
    this.reveal.position.set(this.l.bench.x, this.l.bench.y);
    this.pop = 0.5;
  }

  clearReveal(): void {
    for (const child of this.reveal.removeChildren()) child.destroy({ children: true });
  }

  update(b: Bench, dt: number): void {
    this.clock += dt;
    const locked = b.phase === "locked";
    this.caseBox.visible = locked || b.phase === "spinning";
    this.caseBox.alpha = b.phase === "spinning" ? 0.45 : 1;
    this.pop += (1 - this.pop) * Math.min(1, dt * 10);
    this.caseBox.scale.set(this.pop);
    this.reveal.scale.set(this.pop);
    this.reveal.visible = b.phase === "revealed";
    this.key.eventMode = locked ? "static" : "none";
    this.key.alpha = locked ? 1 : 0.35;
    this.key.scale.set(locked ? 1 + 0.06 * Math.sin(this.clock * 6) : 1);
    this.bin.scale.set(b.phase === "revealed" ? 1 + 0.05 * Math.sin(this.clock * 8) : 1);
    const hint = hintFor(b, this.controller.run.canBrake());
    if (this.hint.text !== hint) this.hint.text = hint;
  }

  private drawCase(): void {
    if (!this.l) return;
    const { w, h } = this.l.caseSize;
    this.caseBody
      .clear()
      .roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: this.caseColor }).stroke({ width: 3, color: 0x000000, alpha: 0.5 })
      .rect(-w / 2, -h * 0.1, w, h * 0.2).fill({ color: 0x000000, alpha: 0.25 });
    this.caseLabel.text = this.caseName;
    this.caseLabel.style.fontSize = Math.max(10, w * 0.1);
    this.caseLabel.position.set(0, h * 0.3);
    const r = Math.min(14, h * 0.2);
    this.lock
      .clear()
      .circle(0, -h * 0.1, r).fill({ color: 0xffd34d }).stroke({ width: 2, color: 0x8a6d1a })
      .rect(-2, -h * 0.1 - r * 0.4, 4, r * 0.8).fill({ color: 0x3a2c05 });
  }
}
