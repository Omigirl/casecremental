import { describe, expect, it } from "vitest";
import { AudioEngine, type AudioDeps, type Ctx } from "./AudioEngine";
import { indexAudio, MUSIC_BOOST, TRACK_GAIN } from "./sounds";

const URLS = {
  "/a/reel-tick-1.mp3": "tick1",
  "/a/reel-tick-2.mp3": "tick2",
  "/a/coin-clink-1.mp3": "coin1",
  "/a/music-1.mp3": "m1",
  "/a/music-2.mp3": "m2",
  "/a/not-a-sound-1.mp3": "junk",
};

/** Just enough of an AudioContext to count what starts. */
function fakeContext(state: AudioContextState = "running", failDecode: (url: string) => boolean = () => false) {
  const started: Array<{ url: string; rate: number; loop: boolean; when: number; offset: number | undefined }> = [];
  const stops: Array<{ url: string; when: number | undefined }> = [];
  /** Every linear gain ramp: when it ends, and the level it ramps to. */
  const ramps: number[] = [];
  const levels: number[] = [];
  /** Every setTargetAtTime level. */
  const targets: number[] = [];
  const param = () => ({
    value: 1,
    setTargetAtTime: (v: number) => void targets.push(v),
    cancelScheduledValues() {},
    linearRampToValueAtTime: (v: number, end: number) => {
      ramps.push(end);
      levels.push(v);
    },
    setValueAtTime() {},
  });
  const node = () => ({ gain: param(), connect: (n: unknown) => n });
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    createGain: node,
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBufferSource: () => {
      const s = {
        buffer: null as { url: string } | null,
        loop: false,
        playbackRate: param(),
        connect: (n: unknown) => n,
        start: (when = 0, offset?: number) => started.push({ url: s.buffer!.url, rate: s.playbackRate.value, loop: s.loop, when, offset }),
        stop: (when?: number) => void stops.push({ url: s.buffer!.url, when }),
      };
      return s;
    },
    decodeAudioData: async (data: ArrayBuffer) => {
      const url = new TextDecoder().decode(data);
      if (failDecode(url)) throw new DOMException("EncodingError");
      return { url, duration: 10 };
    },
    resume: async () => {},
    close: async () => {},
  };
  return { ctx: ctx as unknown as Ctx, started, stops, ramps, levels, targets };
}

const deps = (ctx: Ctx | null, random = () => 0.5): AudioDeps => ({
  createContext: () => ctx,
  load: async (url) => new TextEncoder().encode(url).buffer as ArrayBuffer,
  random,
});

describe("indexAudio", () => {
  it("groups variants and stage loops, ignoring unknown files", () => {
    const files = indexAudio(URLS);
    expect(files.sfx.get("reel-tick")).toEqual(["tick1", "tick2"]);
    expect([...files.music.keys()]).toEqual([1, 2]);
    expect(files.sfx.size).toBe(2);
  });
});

const TRACKS = {
  ...URLS,
  "/a/vault-suspense.mp3": "susp",
  "/a/vault-fanfare-1.mp3": "fan1",
  "/a/vault-fanfare-2.mp3": "fan2",
  "/a/vault-intro-1.mp3": "intro1",
  "/a/prestige.mp3": "pres",
  "/a/vault-rumble-1.mp3": "rumble",
};

describe("indexAudio tracks", () => {
  it("indexes the vault and prestige tracks", () => {
    const files = indexAudio({
      "/a/vault-suspense.mp3": "s",
      "/a/vault-fanfare-1.mp3": "f1",
      "/a/vault-fanfare-2.mp3": "f2",
      "/a/prestige.mp3": "p",
      "/a/music-1.mp3": "m1",
    });
    expect(files.tracks.get("vault-suspense")).toBe("s");
    expect(files.tracks.get("vault-fanfare")).toBe("f1");
    expect(files.tracks.get("prestige")).toBe("p");
    expect(files.music.get(1)).toEqual(["m1"]);
  });

  it("indexes Vaults II and III's fanfares as their own tracks, never as spare takes of Vault I's", () => {
    const files = indexAudio({
      "/a/vault-fanfare-1.mp3": "f1",
      "/a/vault-fanfare-2.mp3": "f2",
      "/a/vault-fanfare-3.mp3": "f3",
    });
    expect(files.tracks.get("vault-fanfare")).toBe("f1");
    expect(files.tracks.get("vault-fanfare-2")).toBe("f2");
    expect(files.tracks.get("vault-fanfare-3")).toBe("f3");
    expect(files.sfx.size).toBe(0);
  });

  it("indexes the vault's intro as its own track, not as the fanfare or an effect", () => {
    const files = indexAudio({ "/a/vault-intro-1.mp3": "i1", "/a/vault-fanfare-1.mp3": "f1" });
    expect(files.tracks.get("vault-intro")).toBe("i1");
    expect(files.tracks.get("vault-fanfare")).toBe("f1");
    expect(files.sfx.size).toBe(0);
  });
});

describe("indexAudio playlists (finish spec §6)", () => {
  it("lists a stage's loops in take order, music-<stage> first, whatever order the files come in", () => {
    const files = indexAudio({
      "/a/music-3-3.mp3": "c",
      "/a/music-3.mp3": "a",
      "/a/music-3-10.mp3": "j",
      "/a/music-3-2.mp3": "b",
      "/a/music-1.mp3": "m1",
    });
    expect(files.music.get(3)).toEqual(["a", "b", "c", "j"]); // numeric take order: 10 comes after 3
    expect(files.music.get(1)).toEqual(["m1"]);
    expect(files.sfx.size).toBe(0);
  });

  it("indexes the Run 4 finale loop on its own, never as a stage's loop or an effect", () => {
    const files = indexAudio({ "/a/music-5.mp3": "m5", "/a/music-finale.mp3": "fin" });
    expect(files.music.get(5)).toEqual(["m5"]);
    expect(files.finale).toBe("fin");
    expect(files.sfx.size).toBe(0);
    expect(indexAudio({}).finale).toBeNull();
  });

  it("indexes the credits as a named track", () => {
    expect(indexAudio({ "/a/credits.mp3": "cr" }).tracks.get("credits")).toBe("cr");
  });

  it("knows which named tracks it has (a credits track may be missing)", () => {
    const a = new AudioEngine({ "a/prestige.mp3": "p" });
    expect(a.hasTrack("prestige")).toBe(true);
    expect(a.hasTrack("credits")).toBe(false);
  });
});

describe("AudioEngine tracks and caps", () => {
  it("plays each vault's own fanfare, at the fanfare's level", async () => {
    const { ctx, started, levels } = fakeContext();
    const a = new AudioEngine({ ...TRACKS, "/a/vault-fanfare-3.mp3": "fan3" }, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    levels.length = 0;
    a.setTrack("vault-fanfare-2", { loop: false, offset: 2 });
    expect(started.find((s) => s.url === "fan2")).toMatchObject({ loop: false, offset: 2 });
    a.setTrack("vault-fanfare-3", { loop: false, offset: 0 });
    expect(started.find((s) => s.url === "fan3")).toMatchObject({ loop: false, offset: 0 });
    expect(started.some((s) => s.url === "fan1")).toBe(false);
    expect(levels.filter((v) => v === TRACK_GAIN["vault-fanfare"]).length).toBeGreaterThanOrEqual(2);
  });

  it("a track takes over from the stage loop, starts at an offset, and hands back", async () => {
    const { ctx, started, stops } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    expect(started.filter((s) => s.loop).map((s) => s.url)).toEqual(["m1"]);
    a.setTrack("vault-fanfare", { loop: false, offset: 4 });
    const fan = started.find((s) => s.url === "fan1")!;
    expect(fan.loop).toBe(false);
    expect(fan.offset).toBe(4);
    expect(stops.some((s) => s.url === "m1")).toBe(true); // the stage loop fades out
    a.setTrack("vault-suspense");
    expect(started.find((s) => s.url === "susp")!.loop).toBe(true);
    expect(stops.some((s) => s.url === "fan1")).toBe(true);
    a.setTrack("prestige");
    expect(started.find((s) => s.url === "pres")!.loop).toBe(true);
    const before = started.filter((s) => s.url === "m1").length;
    a.setTrack(null);
    expect(stops.some((s) => s.url === "pres")).toBe(true);
    expect(started.filter((s) => s.url === "m1")).toHaveLength(before + 1); // the stage loop is back
  });

  it("a one-shot asked for past its end stays silent instead of wrapping to its first bar", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    a.setTrack("vault-fanfare", { loop: false, offset: 13.2 }); // the fake buffers are 10 s long
    expect(started.some((s) => s.url === "fan1")).toBe(false);
    a.setTrack("vault-fanfare", { loop: false, offset: 9.5 });
    expect(started.find((s) => s.url === "fan1")?.offset).toBe(9.5);
  });

  it("re-asking a one-shot moves it to the new offset (a resync mid-intro), a loop asked again carries on", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    a.setTrack("vault-intro", { loop: false, offset: 0 });
    a.setMusicOn(false);
    a.setTrack("vault-intro", { loop: false, offset: 1.6 });
    a.setMusicOn(true);
    expect(started.filter((s) => s.url === "intro1").map((s) => s.offset)).toEqual([0, 1.6]);
    a.setTrack("vault-suspense");
    a.setTrack("vault-suspense");
    expect(started.filter((s) => s.url === "susp")).toHaveLength(1);
  });

  it("an intro with no file yet stays silent", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    expect(() => a.setTrack("vault-intro", { loop: false, offset: 0 })).not.toThrow();
    expect(started.some((s) => !s.loop)).toBe(false);
  });

  it("a track started from its top hits at once (the vault impact); a resume mid-track fades in", async () => {
    const { ctx, ramps } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    ramps.length = 0;
    a.setTrack("vault-fanfare", { loop: false, offset: 0 });
    expect(Math.max(...ramps)).toBeLessThanOrEqual(0.02);
    ramps.length = 0;
    a.setTrack("vault-suspense");
    a.setTrack("vault-fanfare", { loop: false, offset: 4 });
    expect(ramps).toContain(0.3);
  });

  it("stops a capped sound at start + maxSeconds, and leaves an uncapped one alone", async () => {
    const { ctx, started, stops } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.unlock();
    await a.ready;
    a.play("vault-rumble", { delay: 1 });
    a.play("reel-tick");
    const rumble = started.find((s) => s.url === "rumble")!;
    const stop = stops.find((s) => s.url === "rumble")!;
    expect(stop.when).toBeCloseTo(rumble.when + 3.5);
    expect(stops.some((s) => s.url.startsWith("tick"))).toBe(false);
  });

  it("stops a sound still playing (a whisper over the vault's intro), and leaves others alone", async () => {
    const { ctx, stops } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.unlock();
    await a.ready;
    a.play("vault-rumble");
    a.play("reel-tick");
    const before = stops.length;
    a.stop("reel-tick");
    const after = stops.slice(before);
    expect(after.some((s) => s.url.startsWith("tick"))).toBe(true);
    expect(after.some((s) => s.url === "rumble")).toBe(false);
  });
});

describe("AudioEngine", () => {
  it("plays variants with jitter and the combo pitch once unlocked", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.play("reel-tick"); // before unlock: silent
    a.unlock();
    await a.ready;
    a.play("reel-tick", { rate: 2 });
    a.play("reel-tick");
    const ticks = started.filter((s) => s.url.startsWith("tick"));
    expect(ticks.map((s) => s.url)).toEqual(["tick1", "tick2"]);
    expect(ticks[0]!.rate).toBeCloseTo(2);
  });

  it("auditions one exact variant without jitter (the dev sound board)", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(
      URLS,
      deps(ctx, () => 0.99),
    );
    a.unlock();
    await a.ready;
    expect(a.variantCount("reel-tick")).toBe(2);
    expect(a.variantCount("count-ding")).toBe(0);
    a.playVariant("reel-tick", 1);
    a.playVariant("reel-tick", 1);
    a.playVariant("reel-tick", 7); // out of range: nothing
    expect(started.filter((x) => !x.loop).map((x) => [x.url, x.rate])).toEqual([
      ["tick2", 1],
      ["tick2", 1],
    ]);
  });

  it("starts the stage loop and falls back to the nearest lower stage", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.setMusicOn(true);
    a.setStage(4);
    a.unlock();
    await a.ready;
    expect(started.filter((s) => s.loop).map((s) => s.url)).toEqual(["m2"]);
  });

  it("keeps the music off until the game scene turns it on (a click in the lobby unlocks audio, not music)", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.unlock();
    await a.ready;
    expect(started.filter((s) => s.loop)).toHaveLength(0);
    a.setMusicOn(true);
    expect(started.filter((s) => s.loop).map((s) => s.url)).toEqual(["m1"]);
  });

  it("stays silent without an AudioContext (Review Focus 4)", () => {
    const a = new AudioEngine(URLS, deps(null));
    expect(() => {
      a.unlock();
      a.play("coin-clink");
      a.duck(1);
      a.setStage(2);
      a.setVolumes(0.1, 0.1);
      a.dispose();
    }).not.toThrow();
  });

  it("stays silent while autoplay is blocked", async () => {
    const { ctx, started } = fakeContext("suspended");
    const a = new AudioEngine(URLS, deps(ctx));
    a.unlock();
    await a.ready;
    a.play("coin-clink");
    expect(started.filter((s) => !s.loop)).toHaveLength(0);
  });

  it("skips a file that won't decode and plays the rest", async () => {
    const { ctx, started } = fakeContext("running", (url) => url === "/a/coin-clink-1.mp3" || url === "coin1");
    const a = new AudioEngine(URLS, deps(ctx));
    a.unlock();
    await a.ready;
    expect(() => a.play("coin-clink")).not.toThrow();
    a.play("reel-tick");
    expect(started.filter((s) => !s.loop).map((s) => s.url)).toEqual(["tick1"]);
  });

  it("survives a context that throws on creation", () => {
    const a = new AudioEngine(URLS, {
      ...deps(null),
      createContext: () => {
        throw new Error("NotAllowedError");
      },
    });
    expect(() => a.unlock()).not.toThrow();
  });
});

describe("AudioEngine.onReady", () => {
  it("fires once the files have decoded after unlock, and stops after unsubscribe", async () => {
    const { ctx } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    let n = 0;
    const off = a.onReady(() => n++);
    a.unlock();
    expect(n).toBe(0); // still decoding
    await a.ready;
    expect(n).toBe(1);
    off();
    a.dispose();
    const b = new AudioEngine(TRACKS, deps(fakeContext().ctx));
    let m = 0;
    b.onReady(() => m++)();
    b.unlock();
    await b.ready;
    expect(m).toBe(0);
  });

  it("fires once per ready transition: a load left over from a dropped context does not fire again", async () => {
    const a = new AudioEngine(TRACKS, deps(fakeContext().ctx));
    let n = 0;
    a.onReady(() => n++);
    a.unlock();
    const first = a.ready;
    a.dispose(); // the context goes while its files are still decoding
    a.unlock();
    await Promise.all([first, a.ready]);
    expect(n).toBe(1);
    a.unlock(); // already running: nothing to load, nothing fires
    await a.ready;
    expect(n).toBe(1);
  });

  it("music is louder than its slider: the bus is boosted, and the fanfare rides higher than the stage loop", async () => {
    const { ctx, levels, targets } = fakeContext();
    const a = new AudioEngine(TRACKS, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    targets.length = 0;
    a.setVolumes(0.5, 0.8);
    expect(targets[0]).toBeCloseTo(0.5 * MUSIC_BOOST);
    expect(MUSIC_BOOST).toBeGreaterThan(1);
    levels.length = 0;
    a.setTrack("vault-fanfare", { loop: false, offset: 0 });
    expect(levels).toContain(TRACK_GAIN["vault-fanfare"]);
    expect(TRACK_GAIN["vault-fanfare"]).toBeGreaterThan(1);
    expect(TRACK_GAIN["vault-intro"]).toBe(1.4);
  });
});

const PLAYLISTS = {
  "/a/music-1.mp3": "m1",
  "/a/music-3.mp3": "m3",
  "/a/music-3-2.mp3": "m3b",
  "/a/music-3-3.mp3": "m3c",
  "/a/music-4.mp3": "m4",
  "/a/music-5.mp3": "m5",
  "/a/music-5-2.mp3": "m5b",
  "/a/music-5-3.mp3": "m5c",
  "/a/music-finale.mp3": "fin",
  "/a/prestige.mp3": "pres",
};

/** An engine playing `stage`, with a settable clock; `loops()` lists the stage loops started as [url, when]. */
async function playing(stage: number, fail: (url: string) => boolean = () => false) {
  const f = fakeContext("running", fail);
  const a = new AudioEngine(PLAYLISTS, deps(f.ctx));
  a.setMusicOn(true);
  a.setStage(stage);
  a.unlock();
  await a.ready;
  const at = (t: number) => void ((f.ctx as unknown as { currentTime: number }).currentTime = t);
  const loops = () => f.started.filter((s) => s.loop && s.url !== "pres").map((s) => [s.url, s.when] as const);
  return { ...f, a, at, loops };
}

describe("AudioEngine stage playlists (finish spec §6)", () => {
  it("plays a stage's loops in turn, each twice, from its first, swapped on the bar line where its second play ends", async () => {
    const { a, at, loops } = await playing(3);
    expect(loops()).toEqual([["m3", 0]]); // a fresh engine (a reload) starts at the first loop
    at(19);
    a.tick(1);
    expect(loops()).toHaveLength(1); // not yet: more than SWAP_LEAD before the swap
    at(19.9);
    a.tick(1);
    a.tick(1); // asked again on the next frame: already scheduled
    expect(loops()).toEqual([
      ["m3", 0],
      ["m3b", 20],
    ]);
    at(39.9);
    a.tick(1);
    at(59.9);
    a.tick(1);
    expect(loops()).toEqual([
      ["m3", 0],
      ["m3b", 20],
      ["m3c", 40],
      ["m3", 60],
    ]);
  });

  it("crossfades over one bar: the outgoing loop stops just after the fade", async () => {
    const { a, at, stops } = await playing(3);
    at(19.9);
    a.tick(1);
    expect(stops).toContainEqual({ url: "m3", when: 20 + 2 + 0.05 });
  });

  it("a stage with one loop just keeps looping", async () => {
    const { a, at, loops } = await playing(1);
    for (const t of [19.9, 39.9]) {
      at(t);
      a.tick(1);
    }
    expect(loops()).toEqual([["m1", 0]]);
  });

  it("stage 5 takes the finale only in Run 4, after its own loops", async () => {
    const r3 = await playing(5);
    for (const t of [19.9, 39.9, 59.9]) {
      r3.at(t);
      r3.a.tick(3);
    }
    expect(r3.loops().map(([u]) => u)).toEqual(["m5", "m5b", "m5c", "m5"]);
    const r4 = await playing(5);
    for (const t of [19.9, 39.9, 59.9, 79.9]) {
      r4.at(t);
      r4.a.tick(4);
    }
    expect(r4.loops().map(([u]) => u)).toEqual(["m5", "m5b", "m5c", "fin", "m5"]);
  });

  it("a stage change swaps on the next bar line, and coming back brings that stage's next loop", async () => {
    const { a, at, loops } = await playing(3);
    at(5.3);
    a.setStage(4);
    expect(loops().at(-1)).toEqual(["m4", 6]);
    at(9);
    a.setStage(3);
    expect(loops().at(-1)).toEqual(["m3b", 10]);
  });

  it("a stage change in the moment before a swap cancels it: the new stage takes that bar line", async () => {
    const { a, at, loops, stops } = await playing(3);
    at(19.9);
    a.tick(1); // m3b is scheduled at 20
    a.setStage(4);
    expect(loops().at(-1)).toEqual(["m4", 20]);
    expect(stops).toContainEqual({ url: "m3b", when: undefined }); // stopped before it ever plays
    at(21);
    a.setStage(3);
    expect(loops().at(-1)).toEqual(["m3b", 22]); // it comes first when stage 3 is back
  });

  it("a late frame (a hidden tab) swaps on the next bar line from now, never in the past", async () => {
    const { a, at, loops } = await playing(3);
    at(25.3);
    a.tick(1);
    expect(loops().at(-1)).toEqual(["m3b", 26]);
  });

  it("a vault track pauses the playlist; handing back starts the stage's next loop", async () => {
    const { a, at, loops } = await playing(3);
    a.setTrack("prestige");
    at(19.9);
    a.tick(1);
    expect(loops()).toEqual([["m3", 0]]);
    a.setTrack(null);
    expect(loops().at(-1)).toEqual(["m3b", 19.9]);
  });

  it("a loop that fails to decode is skipped", async () => {
    const { a, at, loops } = await playing(3, (url) => url === "m3b");
    at(19.9);
    a.tick(1);
    expect(loops().at(-1)).toEqual(["m3c", 20]);
  });

  it("the sound board can hold one loop (the finale included) until the game asks for a stage, and skip to the next", async () => {
    const { a, at, loops } = await playing(3);
    expect(a.loopCount(5)).toBe(4); // three loops and the finale
    expect(a.loopCount(2)).toBe(0);
    at(3.1);
    a.auditionLoop(5, 3);
    expect(loops().at(-1)).toEqual(["fin", 4]);
    at(23.9);
    a.tick(1);
    expect(loops().at(-1)).toEqual(["fin", 4]); // held: no swap
    a.setStage(3);
    expect(loops().at(-1)![0]).toBe("m3b");
    at(31.1);
    a.skipLoop();
    expect(loops().at(-1)![0]).toBe("m3c");
  });
});
