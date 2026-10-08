import { describe, expect, it } from "vitest";
import { AudioEngine, type AudioDeps, type Ctx } from "./AudioEngine";
import { indexAudio } from "./sounds";

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
  const started: Array<{ url: string; rate: number; loop: boolean }> = [];
  const param = () => ({ value: 1, setTargetAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, setValueAtTime() {} });
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
        start: () => started.push({ url: s.buffer!.url, rate: s.playbackRate.value, loop: s.loop }),
        stop() {},
      };
      return s;
    },
    decodeAudioData: async (data: ArrayBuffer) => {
      const url = new TextDecoder().decode(data);
      if (failDecode(url)) throw new DOMException("EncodingError");
      return { url };
    },
    resume: async () => {},
    close: async () => {},
  };
  return { ctx: ctx as unknown as Ctx, started };
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

  it("starts the stage loop and falls back to the nearest lower stage", async () => {
    const { ctx, started } = fakeContext();
    const a = new AudioEngine(URLS, deps(ctx));
    a.setStage(4);
    a.unlock();
    await a.ready;
    expect(started.filter((s) => s.loop).map((s) => s.url)).toEqual(["m2"]);
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
