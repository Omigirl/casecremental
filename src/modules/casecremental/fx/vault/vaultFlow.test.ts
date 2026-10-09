import { describe, expect, it } from "vitest";
import type { VaultState } from "../../sim/run";
import { VAULT_OPENING_SECONDS } from "../../sim/tuning";
import { bindMusicResync, musicPlan } from "./vaultFlow";

const at = (vault: VaultState | null, over = false) => ({ vault, over });

describe("the music after a lobby trip picks up where the vault is", () => {
  it("waits on the suspense loop while the key waits", () => {
    expect(musicPlan(at({ phase: "key" }), false)).toEqual({ track: "vault-suspense", loop: true, offset: 0, musicOn: true });
  });

  it("resumes the fanfare at the opening's time, not from its top", () => {
    const opening: VaultState = { phase: "opening", t: 4, drops: [], landed: 0 };
    expect(musicPlan(at(opening), false)).toEqual({ track: "vault-fanfare", loop: false, offset: 3, musicOn: true });
    const held: VaultState = { phase: "opening", t: 0.5, drops: [], landed: 0 };
    expect(musicPlan(at(held), false)).toEqual({ track: "vault-fanfare", loop: false, offset: 0, musicOn: false });
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

describe("bindMusicResync", () => {
  const rig = (running = true) => {
    let ready: (() => void) | null = null;
    const listeners = new Set<() => void>();
    const audio = { onReady: (cb: () => void) => ((ready = cb), () => (ready = null)) };
    const doc = {
      visibilityState: "hidden" as "hidden" | "visible",
      addEventListener: (_: string, cb: () => void) => void listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => void listeners.delete(cb),
    };
    let calls = 0;
    const off = bindMusicResync(
      audio,
      doc,
      () => running,
      () => calls++,
    );
    return {
      fireReady: () => ready?.(),
      show: () => ((doc.visibilityState = "visible"), listeners.forEach((l) => l())),
      hide: () => listeners.forEach((l) => l()),
      count: () => calls,
      off,
      listeners,
      hasReady: () => ready !== null,
    };
  };

  it("re-applies the music when the audio becomes ready and when the tab comes back", () => {
    const r = rig();
    r.fireReady();
    expect(r.count()).toBe(1);
    r.hide();
    expect(r.count()).toBe(1); // hiding changes nothing
    r.show();
    expect(r.count()).toBe(2);
  });

  it("leaves the music alone while the scene is suspended (lobby)", () => {
    const r = rig(false);
    r.fireReady();
    r.show();
    expect(r.count()).toBe(0);
  });

  it("unsubscribes both hooks", () => {
    const r = rig();
    r.off();
    expect(r.hasReady()).toBe(false);
    expect(r.listeners.size).toBe(0);
  });
});
