import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import { ITEM_SIZE } from "./layout";

// A skin card at reveal size: a dark frame, a rarity border, the skin's art centred, the StatTrak mark.
// The reveal card and a lifted tray card bake it into a texture.

export function cardFace(art: Texture | null, drop: Drop): Container {
  const { w, h } = ITEM_SIZE.reveal;
  const face = new Container();
  face.addChild(
    new Graphics()
      .rect(0, 0, w, h)
      .fill({ color: 0x120e10 })
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: RARITY_INFO[drop.rarity].color })
      .rect(2, 2, w - 4, h - 4)
      .fill({ color: 0x15161d }),
  );
  if (art) {
    const s = new Sprite(art);
    s.position.set(Math.floor((w - s.width) / 2), Math.floor((h - s.height) / 2));
    face.addChild(s);
  }
  if (drop.statTrak) face.addChild(new Graphics().rect(3, 3, 4, 2).fill({ color: 0xff8a00 }));
  return face;
}
