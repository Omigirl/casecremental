import { describe, expect, it } from "vitest";
import { VAULT_CUE_TIMES, vaultCues } from "./cues";

describe("the vault opening's cues", () => {
  it("spins the lock, bursts, opens, then brings the reels in", () => {
    expect(vaultCues(0)).toMatchObject({ vaultFrame: 1, lockSpin: true, beam: 0, fountain: false, reelsIn: 0 });
    expect(vaultCues(VAULT_CUE_TIMES.burst + 0.1).vaultFrame).toBe(2);
    expect(vaultCues(VAULT_CUE_TIMES.open + 0.1)).toMatchObject({ vaultFrame: 3, fountain: true });
    expect(vaultCues(VAULT_CUE_TIMES.open + 0.1).beam).toBeGreaterThan(0);
    expect(vaultCues(VAULT_CUE_TIMES.reels + 1).reelsIn).toBe(1);
    expect(vaultCues(VAULT_CUE_TIMES.reels - 0.1).reelsIn).toBe(0);
  });
});
