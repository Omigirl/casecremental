import type { Container, Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import type { Rng } from "../../sim/rng";
import type { Juice } from "../juice/juice";
import type { Pt } from "../pixel/layout";
import type { SpriteLibrary, SpriteSet } from "../pixel/sprites";
import type { SkinTextures } from "../skins/pixelSkin";

/** What the World lends the stations. */
export interface StationDeps {
  readonly lib: SpriteLibrary;
  readonly skins: SkinTextures;
  readonly controller: GameController;
  /** Renders a container into a 1:1 nearest-sampled texture (cards). */
  readonly bake: (c: Container) => Texture;
  readonly juice: Juice;
  /** The reel window's frame (drawn in code). */
  readonly reelFrame: SpriteSet;
  /** Visual-only randomness (reel strips) — never the outcome. */
  readonly rng: Rng;
  /** The pixel scale now (it changes on resize). */
  readonly scale: () => number;
  /** Where coins fly: the HUD's cash, screen px. */
  readonly hud: () => Pt;
  /** A ★ knife showcase is in the air somewhere (your bench's or a station's): a grid ★ waits for it to land. */
  readonly knifeFlying: () => boolean;
}
