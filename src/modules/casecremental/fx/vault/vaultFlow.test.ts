import { describe, expect, it } from "vitest";
import type { VaultState } from "../../sim/run";
import { VAULT_OPENING_SECONDS } from "../../sim/tuning";
import { musicPlan } from "./vaultFlow";

const at = (vault: VaultState | null, over = false) => ({ vault, over });

describe("the music after a lobby trip picks up where the vault is", () => {
  it("waits on the suspense loop while the key waits", () => {
    expect(musicPlan(at({ phase: "key" }), false)).toEqual({ track: "vault-suspense", loop: true, offset: 0, musicOn: true });
  });

  it("resumes the fanfare at the opening's time, not from its top", () => {
    const opening: VaultState = { phase: "opening", t: 13.5, drops: [], landed: 3 };
    expect(musicPlan(at(opening), false)).toEqual({ track: "vault-fanfare", loop: false, offset: 13.5, musicOn: true });
    const ended: VaultState = { phase: "opening", t: VAULT_OPENING_SECONDS, drops: [], landed: 5 };
    expect(musicPlan(at(ended), false).track).not.toBe("vault-fanfare"); // past its end it would wrap
  });

  it("plays the prestige loop once the run is over (in the dark)", () => {
    expect(musicPlan(at(null, true), false)).toEqual({ track: "prestige", loop: true, offset: 0, musicOn: true });
  });

  it("keeps the music off while the lights are still coming up", () => {
    expect(musicPlan(at(null), true)).toEqual({ track: null, loop: true, offset: 0, musicOn: false });
  });

  it("otherwise hands back to the stage loop", () => {
    expect(musicPlan(at(null), false)).toEqual({ track: null, loop: true, offset: 0, musicOn: true });
  });
});
