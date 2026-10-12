import type { RarityId } from "../../sim/types";
import type { Juice } from "./juice";

/** The once-only juice of a big card coming up — your bench's best card, a contract's result, a grid breakout:
 *  Classified shakes; Covert hits (hit-stop, impact, duck); ★ slows time and flashes. `zoom` punches the camera in —
 *  only your bench asks for it (the camera centres there). */
export function bigReveal(j: Juice, rarity: RarityId, zoom: boolean): void {
  switch (rarity) {
    case "classified":
      j.shake.add(0.2);
      break;
    case "covert":
      j.time.hitStop(0.08);
      if (zoom) j.zoom.punch(1.1, 0.15);
      j.shake.add(0.55);
      j.audio.play("covert-impact");
      j.audio.duck(1.2);
      break;
    case "gold":
      j.time.slowMo(0.2, 2.2, 0.7);
      if (zoom) j.zoom.punch(1.3, 1.8);
      j.shake.add(0.8);
      j.hd.flash(0xffd700, 0.7);
      j.audio.play("jackpot-swell");
      j.audio.duck(2.6, 0.2);
      break;
  }
}
