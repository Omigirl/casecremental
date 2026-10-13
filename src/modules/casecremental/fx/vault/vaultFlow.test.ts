import { describe, expect, it } from "vitest";
import type { VaultState } from "../../sim/run";
import { VAULT_OPENING_SECONDS } from "../../sim/tuning";
import { VAULT_CUES } from "./cues";
import { BLACKOUT_SECONDS, LIGHTS_UP_SECONDS, lightCues } from "./lights";
import { afterRunTrack, applyMusic, bindMusicResync, musicPlan, PowerCycle, type MusicAudio } from "./vaultFlow";

const at = (vault: VaultState | null, over = false) => ({ vault, over });
const opening = (t: number): VaultState => ({ phase: "opening", t, drops: [], landed: 0 });

/** An audio engine that writes down what it is asked. */
function recorder() {
  const calls: string[] = [];
  const audio: MusicAudio = {
    play: (id) => void calls.push(`play ${id}`),
    setMusicOn: (on) => void calls.push(`music ${on ? "on" : "off"}`),
    setTrack: (id, opts) => void calls.push(`track ${id}${opts ? ` ${JSON.stringify(opts)}` : ""}`),
  };
  return { calls, audio };
}

describe("the music after a lobby trip picks up where the vault is", () => {
  it("plays the run's own vault's fanfare: the same suspense and intro, the same hand-off at t − 3.40", () => {
    for (const fanfare of ["vault-fanfare-2", "vault-fanfare-3"] as const) {
      expect(musicPlan(at({ phase: "key" }), "lit", fanfare).track).toBe("vault-suspense");
      expect(musicPlan(at(opening(1.6)), "lit", fanfare)).toEqual({ track: "vault-intro", loop: false, offset: 1.6, musicOn: true });
      expect(musicPlan(at(opening(3.4)), "lit", fanfare)).toEqual({ track: fanfare, loop: false, offset: 0, musicOn: true });
      const mid = musicPlan(at(opening(6.4)), "lit", fanfare);
      expect(mid).toMatchObject({ track: fanfare, loop: false, musicOn: true });
      expect(mid.offset).toBeCloseTo(3, 9);
      const ended: VaultState = { phase: "opening", t: VAULT_OPENING_SECONDS, drops: [], landed: 5 };
      expect(musicPlan(at(ended), "lit", fanfare).track).toBeNull();
    }
    expect(musicPlan(at(opening(6.4)), "lit").track).toBe("vault-fanfare"); // Vault I by default
  });

  it("waits on the suspense loop while the key waits", () => {
    expect(musicPlan(at({ phase: "key" }), "lit")).toEqual({ track: "vault-suspense", loop: true, offset: 0, musicOn: true });
  });

  it("plays the intro from the key turn, at the opening's time, up to the impact", () => {
    expect(musicPlan(at(opening(0)), "lit")).toEqual({ track: "vault-intro", loop: false, offset: 0, musicOn: true });
    expect(musicPlan(at(opening(1.6)), "lit")).toEqual({ track: "vault-intro", loop: false, offset: 1.6, musicOn: true });
    expect(musicPlan(at(opening(3.39)), "lit")).toEqual({ track: "vault-intro", loop: false, offset: 3.39, musicOn: true });
  });

  it("hands over to the fanfare on the impact, from its top, then at t − 3.40", () => {
    expect(VAULT_CUES.impact).toBe(3.4);
    expect(musicPlan(at(opening(3.4)), "lit")).toEqual({ track: "vault-fanfare", loop: false, offset: 0, musicOn: true });
    const mid = musicPlan(at(opening(6.4)), "lit");
    expect(mid).toMatchObject({ track: "vault-fanfare", loop: false, musicOn: true });
    expect(mid.offset).toBeCloseTo(3, 9);
  });

  it("runs the fanfare to just before the end, and nothing past it (a one-shot past its end would wrap)", () => {
    const late = musicPlan(at(opening(VAULT_OPENING_SECONDS - 0.01)), "lit");
    expect(late).toMatchObject({ track: "vault-fanfare", loop: false, musicOn: true });
    expect(late.offset).toBeCloseTo(VAULT_OPENING_SECONDS - 0.01 - VAULT_CUES.impact, 9);
    const ended: VaultState = { phase: "opening", t: VAULT_OPENING_SECONDS, drops: [], landed: 5 };
    expect(musicPlan(at(ended), "lit").track).toBeNull();
  });

  it("plays the prestige loop once the run is over (in the dark)", () => {
    expect(musicPlan(at(null, true), "dark")).toEqual({ track: "prestige", loop: true, offset: 0, musicOn: true });
    expect(musicPlan(at(null, true), "lit")).toEqual({ track: "prestige", loop: true, offset: 0, musicOn: true }); // a reload
  });

  it("keeps the prestige loop waiting while the blackout still falls (a lobby trip mid-fade)", () => {
    expect(musicPlan(at(null, true), "blackout")).toEqual({ track: "prestige", loop: true, offset: 0, musicOn: false });
  });

  it("keeps the music off while the lights are still coming up", () => {
    expect(musicPlan(at(null), "powerUp")).toEqual({ track: null, loop: true, offset: 0, musicOn: false });
  });

  it("otherwise hands back to the stage loop", () => {
    expect(musicPlan(at(null), "lit")).toEqual({ track: null, loop: true, offset: 0, musicOn: true });
  });
});

describe("the music after The Last Case (finish spec §7.4)", () => {
  it("picks the credits track while the credits roll, the prestige loop after (Review Focus 1)", () => {
    const over = at(null, true);
    expect(musicPlan(over, "dark", "vault-fanfare", "credits").track).toBe("credits");
    expect(musicPlan(over, "dark").track).toBe("prestige");
    expect(musicPlan(over, "blackout", "vault-fanfare", "credits")).toMatchObject({ track: "credits", musicOn: false });
  });

  it("falls back to the prestige loop without a credits track (Review Focus 3)", () => {
    expect(afterRunTrack(true, true)).toBe("credits");
    expect(afterRunTrack(true, false)).toBe("prestige");
    expect(afterRunTrack(false, true)).toBe("prestige");
  });
});

describe("applyMusic", () => {
  it("arms a silent plan's track as the plan says (a one-shot stays a one-shot), with the music off", () => {
    const r = recorder();
    applyMusic(r.audio, { track: "vault-intro", loop: false, offset: 0, musicOn: false });
    expect(r.calls).toEqual(["music off", 'track vault-intro {"loop":false,"offset":0}']);
  });

  it("picks the track while the music is off, then turns it on", () => {
    const r = recorder();
    applyMusic(r.audio, { track: "vault-fanfare", loop: false, offset: 3, musicOn: true });
    expect(r.calls).toEqual(["music off", 'track vault-fanfare {"loop":false,"offset":3}', "music on"]);
  });
});

describe("PowerCycle", () => {
  /** Steps `seconds` in 1/60 s frames; returns the last frame's light levels. */
  const run = (p: PowerCycle, seconds: number) => {
    let levels = p.update(0);
    for (let s = 0; s < seconds; s += 1 / 60) levels = p.update(1 / 60);
    return levels;
  };

  it("fades to black, then starts the prestige loop in the dark", () => {
    const r = recorder();
    const p = new PowerCycle(r.audio);
    expect(p.phase).toBe("lit");
    p.blackout();
    expect(r.calls).toEqual(["play blackout"]);
    expect(p.phase).toBe("blackout");
    const mid = run(p, BLACKOUT_SECONDS / 2);
    expect(mid.room).toBeGreaterThan(0);
    expect(mid.room).toBeLessThan(1);
    expect(r.calls).toEqual(["play blackout"]); // no music yet
    const black = run(p, BLACKOUT_SECONDS / 2 + 0.05);
    expect(Object.values(black).every((v) => v === 0)).toBe(true);
    expect(p.phase).toBe("dark");
    // the track first, then on: a lobby trip mid-fade left the music off (musicPlan "blackout")
    expect(r.calls).toEqual(["play blackout", 'track prestige {"loop":true}', "music on"]);
    run(p, 3);
    expect(r.calls).toHaveLength(3); // once
  });

  it("fades to black, then starts the run's after-track in the dark (the credits after The Last Case)", () => {
    const r = recorder();
    const p = new PowerCycle(r.audio);
    p.blackout("credits");
    run(p, BLACKOUT_SECONDS + 0.05);
    expect(r.calls).toEqual(["play blackout", 'track credits {"loop":true}', "music on"]);
  });

  it("is already dark after a reload on the prestige screen, leaving the music to musicPlan", () => {
    const r = recorder();
    const p = new PowerCycle(r.audio);
    p.darkNow();
    expect(p.phase).toBe("dark");
    expect(Object.values(p.update(1 / 60)).every((v) => v === 0)).toBe(true);
    expect(r.calls).toEqual([]);
  });

  it("powers the workshop back up in silence, then hands the music back to the stage loop", () => {
    const r = recorder();
    const p = new PowerCycle(r.audio);
    p.blackout();
    run(p, BLACKOUT_SECONDS + 1);
    r.calls.length = 0;
    p.powerUp();
    expect(p.phase).toBe("powerUp");
    expect(r.calls).toEqual(["music off", "track null", "play run-start"]);
    run(p, LIGHTS_UP_SECONDS - 0.1);
    expect(p.phase).toBe("powerUp");
    expect(r.calls).not.toContain("music on");
    expect(r.calls.filter((c) => c.startsWith("play light-"))).toHaveLength(lightCues.length);
    const lit = run(p, 0.2);
    expect(Object.values(lit).every((v) => v === 1)).toBe(true);
    expect(p.phase).toBe("lit");
    expect(r.calls.at(-1)).toBe("music on");
    expect(r.calls.filter((c) => c === "music on")).toHaveLength(1);
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
