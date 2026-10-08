import { barSeconds, crossfade, jitter, musicFor, nextBar, pickVariant } from "./schedule";
import { indexAudio, maxSecondsOf, SOUNDS, type AudioFiles, type SoundId, type TrackId } from "./sounds";

// The mixer (spec §9): music / SFX / UI buses into a limiter, music that swaps on bar lines when the
// stage changes and ducks under big reveals, per-play pitch and level jitter. Audio unlocks on the
// first user gesture. Anything missing — no AudioContext, autoplay blocked, a file that won't load
// or decode — leaves that sound silent and the game running (Review Focus 4).

const FILES = import.meta.glob("../../assets/audio/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export interface PlayOptions {
  /** Pitch multiplier on top of the jitter (combo pitch, rarity). */
  rate?: number;
  gain?: number;
  /** Seconds from now. */
  delay?: number;
}

export type Ctx = Pick<
  AudioContext,
  | "createGain"
  | "createBufferSource"
  | "createDynamicsCompressor"
  | "decodeAudioData"
  | "currentTime"
  | "destination"
  | "state"
  | "resume"
  | "close"
>;

export interface AudioDeps {
  createContext: () => Ctx | null;
  load: (url: string) => Promise<ArrayBuffer>;
  random: () => number;
}

const browserDeps: AudioDeps = {
  createContext: () => {
    const AC =
      typeof window !== "undefined"
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    try {
      return AC ? new AC() : null;
    } catch {
      return null;
    }
  },
  load: async (url) => (await fetch(url)).arrayBuffer(),
  random: Math.random,
};

interface Loop {
  stage: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface WantTrack {
  id: TrackId;
  loop: boolean;
  offset: number;
}

interface PlayingTrack {
  want: WantTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioEngine {
  private ctx: Ctx | null = null;
  private buses: { music: GainNode; sfx: GainNode; ui: GainNode; duck: GainNode } | null = null;
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private readonly last = new Map<SoundId, number>();
  private readonly files: AudioFiles;
  private volumes = { music: 0.6, sfx: 0.8 };
  private loop: Loop | null = null;
  private loopStartedAt = 0;
  private wantStage = 1;
  private track: PlayingTrack | null = null;
  private wantTrack: WantTrack | null = null;
  /** Off until the game scene activates: a click in the lobby unlocks audio, never the music. */
  private musicOn = false;
  /** Resolves when every file has loaded (or failed to). */
  ready: Promise<void> = Promise.resolve();

  constructor(
    urls: Record<string, string> = FILES,
    private readonly deps: AudioDeps = browserDeps,
  ) {
    this.files = indexAudio(urls);
  }

  /** Call from a user gesture. Safe to call often; does nothing once running. */
  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = this.deps.createContext();
        if (!this.ctx) return;
        this.buildBuses(this.ctx);
        this.ready = this.preload();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      this.updateMusic();
    } catch {
      this.ctx = null;
      this.buses = null;
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.volumes = { music, sfx };
    const b = this.buses;
    if (!b || !this.ctx) return;
    b.music.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
    b.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    b.ui.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  play(id: SoundId, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b || ctx.state !== "running") return;
    const urls = this.files.sfx.get(id);
    if (!urls?.length) return;
    const v = pickVariant(urls.length, this.last.get(id) ?? -1, this.deps.random);
    this.last.set(id, v);
    const j = jitter(this.deps.random);
    this.start(id, urls[v]!, j.rate * (opts.rate ?? 1), j.gain * (opts.gain ?? 1), opts.delay ?? 0);
  }

  /** How many generated files a sound has (the dev sound board lists them). */
  variantCount(id: SoundId): number {
    return this.files.sfx.get(id)?.length ?? 0;
  }

  /** One exact variant, no jitter — for auditioning in the dev sound board. */
  playVariant(id: SoundId, n: number): void {
    const url = this.files.sfx.get(id)?.[n];
    if (url && this.ctx?.state === "running") this.start(id, url, 1, 1, 0);
  }

  private start(id: SoundId, url: string, rate: number, gain: number, delay: number): void {
    const ctx = this.ctx;
    const b = this.buses;
    const buffer = this.buffers.get(url);
    if (!ctx || !b || !buffer) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = SOUNDS[id].gain * gain;
      src.connect(g).connect(SOUNDS[id].bus === "ui" ? b.ui : b.sfx);
      const at = ctx.currentTime + delay;
      src.start(at);
      const cap = maxSecondsOf(id);
      if (cap !== undefined) {
        const end = at + cap;
        g.gain.setValueAtTime(g.gain.value, Math.max(at, end - 0.15));
        g.gain.linearRampToValueAtTime(0, end);
        src.stop(end);
      }
    } catch {
      // a node failed to start: skip this one sound
    }
  }

  /** Music under a big moment: down quickly, back up after `seconds`. */
  duck(seconds: number, depth = 0.35): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b) return;
    const now = ctx.currentTime;
    b.duck.gain.cancelScheduledValues(now);
    b.duck.gain.setTargetAtTime(depth, now, 0.03);
    b.duck.gain.setTargetAtTime(1, now + seconds, 0.4);
  }

  /** The intensity stage changed: swap loops on the next bar line. */
  setStage(stage: number): void {
    this.wantStage = stage;
    this.updateMusic();
  }

  /** The scene was suspended (lobby) or resumed. */
  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (!on) {
      this.stopLoop(0.3);
      this.stopTrack(0.3);
    } else this.updateMusic();
  }

  /** A named track (the vault's suspense and fanfare, the prestige loop) replaces the stage loop; null
   *  hands back to it. A one-shot can start part-way (a reload mid-fanfare). */
  setTrack(id: TrackId | null, opts: { loop?: boolean; offset?: number } = {}): void {
    if ((this.wantTrack?.id ?? null) === id && id !== "vault-fanfare") return;
    this.wantTrack = id ? { id, loop: opts.loop ?? true, offset: opts.offset ?? 0 } : null;
    this.updateMusic();
  }

  dispose(): void {
    this.stopLoop(0);
    this.stopTrack(0);
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.buses = null;
  }

  private buildBuses(ctx: Ctx): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    const bus = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const duck = bus(1);
    const music = bus(this.volumes.music);
    music.connect(duck).connect(limiter);
    const sfx = bus(this.volumes.sfx);
    sfx.connect(limiter);
    const ui = bus(this.volumes.sfx);
    ui.connect(limiter);
    this.buses = { music, sfx, ui, duck };
  }

  private async preload(): Promise<void> {
    const urls = [...this.files.music.values(), ...this.files.tracks.values(), ...[...this.files.sfx.values()].flat()];
    await Promise.all(urls.map((u) => this.loadBuffer(u)));
    this.updateMusic();
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return this.buffers.get(url) ?? null;
    this.buffers.set(url, null);
    try {
      const ctx = this.ctx;
      if (!ctx) return null;
      const buffer = await ctx.decodeAudioData(await this.deps.load(url));
      this.buffers.set(url, buffer);
      return buffer;
    } catch {
      return null; // stays silent
    }
  }

  private updateMusic(): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b || !this.musicOn) return;
    if (this.wantTrack) {
      this.stopLoop(0.6);
      if (this.track?.want !== this.wantTrack) this.startTrack(this.wantTrack);
      return;
    }
    this.stopTrack(0.6);
    const stage = musicFor(this.wantStage, [...this.files.music.keys()]);
    if (stage === null || this.loop?.stage === stage) return;
    const buffer = this.buffers.get(this.files.music.get(stage)!);
    if (!buffer) return; // not decoded yet — preload() calls again when it is
    try {
      const at = this.loop ? nextBar(ctx.currentTime, this.loopStartedAt) : ctx.currentTime;
      const fade = this.loop ? barSeconds() : 0.5;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, at);
      source.connect(gain).connect(b.music);
      source.start(at);
      const steps = 8;
      for (let i = 1; i <= steps; i++) gain.gain.linearRampToValueAtTime(crossfade(i / steps)[1], at + (fade * i) / steps);
      if (this.loop) {
        const old = this.loop.gain;
        old.gain.setValueAtTime(old.gain.value, at);
        for (let i = 1; i <= steps; i++) old.gain.linearRampToValueAtTime(crossfade(i / steps)[0], at + (fade * i) / steps);
        this.loop.source.stop(at + fade + 0.05);
      }
      this.loopStartedAt = at;
      this.loop = { stage, source, gain };
    } catch {
      // music is optional
    }
  }

  private stopLoop(fade: number): void {
    const l = this.loop;
    const ctx = this.ctx;
    this.loop = null;
    if (!l || !ctx) return;
    try {
      l.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
      l.source.stop(ctx.currentTime + fade + 0.05);
    } catch {
      // already stopped
    }
  }

  private startTrack(want: WantTrack): void {
    const ctx = this.ctx;
    const b = this.buses;
    const url = this.files.tracks.get(want.id);
    const buffer = url ? this.buffers.get(url) : null;
    if (!ctx || !b || !buffer) return; // not decoded yet — preload() calls again when it is
    this.stopTrack(0.3);
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = want.loop;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + 0.3);
      source.connect(gain).connect(b.music);
      const length = buffer.duration > 0 ? buffer.duration : 0;
      source.start(now, length ? want.offset % length : 0);
      this.track = { want, source, gain };
    } catch {
      // music is optional
    }
  }

  private stopTrack(fade: number): void {
    const t = this.track;
    const ctx = this.ctx;
    this.track = null;
    if (!t || !ctx) return;
    try {
      t.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
      t.source.stop(ctx.currentTime + fade + 0.05);
    } catch {
      // already stopped
    }
  }
}
