import { skinName, wearName, weaponName } from "../i18n/content";
import { getLang, type StringKey } from "../i18n/index";
import { skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import type { Bench } from "../sim/run";
import type { Drop } from "../sim/types";
import { wearOf } from "../sim/wear";

// Text on the canvas, built from state in the current language every frame — so switching the
// language mid-run (reel spinning, card up) updates it at once (Review Focus 2).

export function hintKey(b: Bench, canBrake: boolean): StringKey | null {
  switch (b.phase) {
    case "empty":
      return "hint.buy";
    case "locked":
      return "hint.key";
    case "spinning":
      return canBrake ? "hint.brake" : null;
    case "revealed":
      return "hint.sell";
  }
}

/** The two lines under the reveal card. */
export function revealLines(d: Drop): [string, string] {
  const skin = skinById(d.skinId);
  const st = d.statTrak ? "ST™ " : "";
  return [`${st}${weaponName(skin.weapon)} | ${skinName(skin.id)}`, `${wearName(wearOf(d.float).id)} · ${formatCash(d.value, getLang())}`];
}
