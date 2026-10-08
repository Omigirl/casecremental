import { BLACKOUT_SECONDS } from "../fx/vault/lights";
import type { PrestigeView } from "../game/view";
import type { CharmId } from "../sim/charms";

// The prestige screen's rules (M2b spec §8): pick up to `slots` of the three offered charms; the screen
// waits for the blackout when you watched the run end, and comes up at once after a reload.

export function charmChoices(p: PrestigeView): Array<{ id: CharmId; picked: boolean; enabled: boolean }> {
  return p.offer.map((id) => {
    const picked = p.picked.includes(id);
    return { id, picked, enabled: picked || p.picked.length < p.slots };
  });
}

/** The blackout plus a beat. */
export const PRESTIGE_DELAY_MS = Math.round(BLACKOUT_SECONDS * 1000) + 300;

export const prestigeDelayMs = (sawRunEnd: boolean): number => (sawRunEnd ? PRESTIGE_DELAY_MS : 0);
