import type { AudioEngine } from "../audio/AudioEngine";
import type { HdLayer } from "../hd/HdLayer";
import type { Shake } from "./shake";
import type { TimeScale } from "./timeScale";
import type { Zoom } from "./zoom";

/** The juice the World owns and lends to the parts that drive their own effects (the bench's reveal, the
 *  vault's reels). */
export interface Juice {
  readonly hd: HdLayer;
  readonly audio: AudioEngine;
  readonly shake: Shake;
  readonly zoom: Zoom;
  readonly time: TimeScale;
}
