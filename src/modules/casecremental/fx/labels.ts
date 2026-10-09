import { skinName, wearName, weaponName } from "../i18n/content";
import { getLang, type StringKey } from "../i18n/index";
import { skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import type { Bench, RunState } from "../sim/run";
import type { Drop } from "../sim/types";
import { wearOf } from "../sim/wear";

// Text on the canvas, built from state in the current language every frame — so switching the
// language mid-run (reel spinning, card up) updates it at once (Review Focus 2).

/** The next step's hint under your reel. In portrait it would sit on a single card's top, so it is dropped there. */
export function hintKey(b: Bench, portrait = false): StringKey | null {
  switch (b.phase) {
    case "empty":
      return "hint.buy";
    case "locked":
      return "hint.key";
    case "spinning":
      return null;
    case "revealed":
      // over a multi-open pair (even half-sold) the hint would sit on the cards' tops: the label lines are enough
      return b.cards.length > 1 || portrait ? null : "hint.sell";
  }
}

/** The two lines under the reveal card. */
export function revealLines(d: Drop): [string, string] {
  const skin = skinById(d.skinId);
  const st = d.statTrak ? "ST™ " : "";
  return [`${st}${weaponName(skin.weapon)} | ${skinName(skin.id)}`, `${wearName(wearOf(d.float).id)} · ${formatCash(d.value, getLang())}`];
}

/** The centre for a line `width` wide that wants to sit at `want` but must stay within [lo, hi]. */
export function fitCentre(want: number, width: number, lo: number, hi: number): number {
  if (width >= hi - lo) return (lo + hi) / 2;
  return Math.min(hi - width / 2, Math.max(lo + width / 2, want));
}

/** The claim tray is full while the auto-seller is on: a card above its threshold has nowhere to go. */
export function trayFull(state: { seller: { on: boolean }; tray: readonly unknown[] }, capacity: number): boolean {
  return state.seller.on && state.tray.length >= capacity;
}

/** The sell bin's light calls while a card waits to be sold: on your bench or at the bot's station. */
export function binCalling(state: { bench: Bench; bot: Pick<RunState["bot"], "card"> }): boolean {
  return state.bench.phase === "revealed" || state.bot.card !== null;
}
