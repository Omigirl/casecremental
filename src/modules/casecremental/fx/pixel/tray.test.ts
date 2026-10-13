import { Container, Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { GameController } from "../../game/controller";
import type { Drop } from "../../sim/types";
import type { SkinTextures } from "../skins/pixelSkin";
import { tableLayout } from "./layout";
import { TrayView } from "./Tray";
import { traySlots } from "./traySlots";

// A tapped claim's coins and "+$" start at the card's slot. The sim splices a claimed drop out of the tray array before
// the view hears of it, so the slot comes from the view's last frame.

const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
const skins = { texture: () => tex, size: () => ({ w: 26, h: 10 }), thumb: () => tex, frames: () => [] } as unknown as SkinTextures;
const drop = (id: number): Drop =>
  ({ id, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec", float: 0.1, wear: "MW", statTrak: false, value: 1 }) as Drop;

describe("TrayView.claimed", () => {
  const l = tableLayout({ worldW: 320, worldH: 180, portrait: false });
  const make = () => new TrayView(skins, {} as GameController, () => tex, { scale: () => 1, onLand: () => {} });

  it("is the slot's centre, though the sim has already spliced the card out of the tray array", () => {
    const view = make();
    view.layout(l);
    const items = [drop(1), drop(2), drop(3)];
    view.update(items, 6, 0.016, false);
    items.splice(1, 1); // run.claim() removes it before the view hears of the sale
    const r = traySlots(l.tray, 6)[1]!;
    expect(view.claimed(2)).toEqual({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  });

  it("falls back to the tray's centre for a card it never saw", () => {
    const view = make();
    view.layout(l);
    view.update([drop(1)], 6, 0.016, false);
    expect(view.claimed(99)).toEqual({ x: l.tray.x + l.tray.w / 2, y: l.tray.y + l.tray.h / 2 });
  });
});
