import { vaultFor } from "../../sim/content/vaults";
import type { Run } from "../../sim/run";
import type { PowerCycle } from "./vaultFlow";
import type { VaultBeams } from "./VaultBeams";
import type { VaultScene } from "./VaultScene";

// The run's vault on the World's vault scene and beams, read from the sim (out of World.ts for its size): which vault
// it is every frame, and where it is on a reload or a new run.

/** The run's vault (sim/content/vaults: I in Run 1, II in Run 2, III in Run 3, The Last Case from Run 4 on) on the
 *  scene and the beams: set every frame (a no-op for the same vault) and before the beams restore, so a reload
 *  mid-opening keeps its look. */
export function syncVault(run: Run, scene: VaultScene, beams: VaultBeams): void {
  const def = vaultFor(run.setup.run);
  scene.setVault(def);
  beams.setVault(def);
}

/** A reload or a new run: the vault's key or opening where the sim is, or the dark (the World then asks for the music
 *  from the sim, so a stale track goes). */
export function restoreVault(run: Run, scene: VaultScene, beams: VaultBeams, power: PowerCycle): void {
  syncVault(run, scene, beams);
  const v = run.state.vault;
  if (v?.phase === "opening") beams.restore(v.drops, v.landed);
  if (!v && run.state.over) power.darkNow();
}
