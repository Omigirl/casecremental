import { describe, expect, it } from "vitest";
import { caseById, skinById } from "./cases";
import { VAULTS, vaultFor } from "./vaults";
import { Run, DEFAULT_SETUP } from "../run";

describe("vaults", () => {
  it("one per run, its legend an animated knife, its rewards from the run's top case", () => {
    expect(VAULTS.map((v) => [v.id, v.run, v.sourceCase])).toEqual([
      ["vault1", 1, "bedrock"],
      ["vault2", 2, "neon"],
      ["vault3", 3, "inferno"],
    ]);
    for (const v of VAULTS) {
      expect(skinById(v.legend.id)).toBe(v.legend);
      expect(v.legend.weapon).toBe("knife");
      expect(v.legend.motion?.weapon).toBe("flip");
      expect(caseById(v.sourceCase)).toBeDefined();
    }
    expect(vaultFor(9).id).toBe("vault3");
  });

  it("Vault II pays out Neon Nights drops and its own legend", () => {
    const run = new Run(7, { ...DEFAULT_SETUP, run: 2, startCash: 1e12, vaultPrice: 1e6 });
    for (const id of ["wildwood", "bedrock", "mainframe", "neon"]) expect(run.unlockCase(id).ok).toBe(true);
    expect(run.buyVault().ok).toBe(true);
    expect(run.turnVaultKey().ok).toBe(true);
    const drops = run.state.vault!.phase === "opening" ? run.state.vault!.drops : [];
    expect(drops.slice(0, 4).every((d) => d.caseId === "neon")).toBe(true);
    expect(drops[4]!.skinId).toBe("vault2_legend");
    expect(drops[4]!.caseId).toBe("vault2");
    for (let i = 0; i < 18 * 30; i++) run.tick(1 / 30);
    expect(run.drainEvents().find((e) => e.type === "vaultOpened")).toMatchObject({ trophy: "vault2" });
  });
});
