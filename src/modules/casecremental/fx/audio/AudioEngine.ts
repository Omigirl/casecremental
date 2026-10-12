import { jitter, pickVariant } from "./schedule";
import { StageMusic, type BufferOf } from "./stageMusic";
import { indexAudio, maxSecondsOf, MUSIC_BOOST, SOUNDS, TRACK_GAIN, type AudioFiles, type SoundId, type TrackId } from "./sounds";

// The mixer (spec §9): music / SFX / UI buses into a limiter, the stage music (fx/audio/stageMusic.ts: each stage's
// loops as a playlist, swapped on bar lines) that ducks under big reveals, per-play pitch and level jitter. Audio unlocks on the
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
  /** The sound effects still playing, per id, so one can be stopped early. */
  private readonly playing = new Map<SoundId, Set<{ src: AudioBufferSourceNode; g: GainNode }>>();
  private readonly files: AudioFiles;
  private volumes = { music: 0.6, sfx: 0.8 };
  private wantStage = 1;
  private readonly stageMusic: StageMusic;
  /** The campaign's run, from tick(): stage 5 takes Run 4's finale. */
  private run = 1;
  private readonly bufferOf: BufferOf = (url) => this.buffers.get(url);
  private track: PlayingTrack | null = null;
  private wantTrack: WantTrack | null = null;
  /** Off until the game scene activates: a click in the lobby unlocks audio, never the music. */
  private musicOn = false;
  /** Resolves when every file has loaded (or failed to). */
  ready: Promise<void> = Promise.resolve();
  private readonly readyListeners = new Set<() => void>();
  /** Which context's load is current: one left over from a dropped context neither restarts music nor fires. */
  private loadGen = 0;

  constructor(
    urls: Record<string, string> = FILES,
    private readonly deps: AudioDeps = browserDeps,
  ) {
    this.files = indexAudio(urls);
    this.stageMusic = new StageMusic(this.files);
  }

  /** Call from a user gesture. Safe to call often; does nothing once running. */
  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = this.deps.createContext();
        if (!this.ctx) return;
        this.buildBuses(this.ctx);
        this.ready = this.preload(++this.loadGen);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      this.updateMusic();
    } catch {
      this.ctx = null;
      this.buses = null;
    }
  }

  /** Fires once each time the files have finished decoding for a new context (the sound can play now); returns
   *  the unsubscribe. */
  onReady(cb: () => void): () => void {
    this.readyListeners.add(cb);
    return () => void this.readyListeners.delete(cb);
  }

  setVolumes(music: number, sfx: number): void {
    this.volumes = { music, sfx };
    const b = this.buses;
    if (!b || !this.ctx) return;
    b.music.gain.setTargetAtTime(music * MUSIC_BOOST, this.ctx.currentTime, 0.05);
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

  /** Stop a sound that is still playing, with a short fade (a whisper must not run over the vault's intro). */
  stop(id: SoundId, fade = 0.08): void {
    const ctx = this.ctx;
    const live = this.playing.get(id);
    if (!ctx || !live) return;
    for (const { src, g } of live) {
      try {
        g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        src.stop(ctx.currentTime + fade);
      } catch {
        // already stopped
      }
    }
    live.clear();
  }

  /** The named track has a file (a credits track may be missing: the prestige loop stands in). */
  hasTrack(id: TrackId): boolean {
    return this.files.tracks.has(id);
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
      const live = this.playing.get(id) ?? new Set();
      const entry = { src, g };
      live.add(entry);
      this.playing.set(id, live);
      src.onended = () => live.delete(entry);
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

  /** The intensity stage changed: its playlist starts on the next bar line (at the loop after the one it last played). */
  setStage(stage: number): void {
    this.wantStage = stage;
    this.updateMusic();
  }

  /** Every frame (World.update): the stage playlist's clock — a hand-over is scheduled on the audio clock just before its
   *  bar line — and the campaign's run: stage 5 takes Run 4's finale loop from Run 4 on (finish spec §6). */
  tick(run: number): void {
    this.run = run;
    const ctx = this.ctx;
    const b = this.buses;
    if (!ctx || !b || !this.musicOn || this.wantTrack) return;
    this.stageMusic.tick(ctx, b.music, this.bufferOf, run);
  }

  /** Dev sound board: hold one loop of a stage's playlist (stage 5's last is Run 4's finale) until a stage is asked for. */
  auditionLoop(stage: number, index: number): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (ctx && b && this.musicOn && !this.wantTrack) this.stageMusic.audition(ctx, b.music, this.bufferOf, stage, index);
  }

  /** Dev sound board: the playlist's next loop on the next bar line. */
  skipLoop(): void {
    const ctx = this.ctx;
    const b = this.buses;
    if (ctx && b && this.musicOn && !this.wantTrack) this.stageMusic.skip(ctx, b.music, this.bufferOf, this.run);
  }

  /** Dev sound board: how many loops a stage's playlist has (stage 5 counts the finale). */
  loopCount(stage: number): number {
    return this.stageMusic.length(stage);
  }

  /** The scene was suspended (lobby) or resumed. */
  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (!on) {
      this.stageMusic.stop(this.ctx, 0.3);
      this.stopTrack(0.3);
    } else this.updateMusic();
  }

  /** A named track (the vault's suspense, intro and fanfare, the prestige loop) replaces the stage loop; null
   *  hands back to it. A one-shot can start part-way (a reload mid-intro or mid-fanfare): asked again, it moves to
   *  the new offset; a loop asked again carries on. */
  setTrack(id: TrackId | null, opts: { loop?: boolean; offset?: number } = {}): void {
    if ((this.wantTrack?.id ?? null) === id && opts.loop !== false) return;
    this.wantTrack = id ? { id, loop: opts.loop ?? true, offset: opts.offset ?? 0 } : null;
    this.updateMusic();
  }

  dispose(): void {
    this.stageMusic.stop(this.ctx, 0);
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
    const music = bus(this.volumes.music * MUSIC_BOOST);
    music.connect(duck).connect(limiter);
    const sfx = bus(this.volumes.sfx);
    sfx.connect(limiter);
    const ui = bus(this.volumes.sfx);
    ui.connect(limiter);
    this.buses = { music, sfx, ui, duck };
  }

  private async preload(gen: number): Promise<void> {
    const urls = [
      ...[...this.files.music.values()].flat(),
      ...(this.files.finale ? [this.files.finale] : []),
      ...this.files.tracks.values(),
      ...[...this.files.sfx.values()].flat(),
    ];
    await Promise.all(urls.map((u) => this.loadBuffer(u)));
    if (gen !== this.loadGen || !this.ctx) return; // a dropped context's load: the current one fires
    this.updateMusic();
    for (const cb of [...this.readyListeners]) cb();
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
      this.stageMusic.stop(ctx, 0.6);
      if (this.track?.want !== this.wantTrack) this.startTrack(this.wantTrack);
      return;
    }
    this.stopTrack(0.6);
    this.stageMusic.want(ctx, b.music, this.bufferOf, this.wantStage, this.run);
  }

  private startTrack(want: WantTrack): void {
    const ctx = this.ctx;
    const b = this.buses;
    const url = this.files.tracks.get(want.id);
    const buffer = url ? this.buffers.get(url) : null;
    if (!ctx || !b || !buffer) return; // not decoded yet — preload() calls again when it is
    this.stopTrack(0.3);
    // a one-shot asked for past its end has finished: silence, not its first bar again
    if (!want.loop && buffer.duration > 0 && want.offset >= buffer.duration) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = want.loop;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, now);
      // from its top (the vault's impact) the first downbeat hits at once; a resume mid-track fades in
      gain.gain.linearRampToValueAtTime(TRACK_GAIN[want.id], now + (want.offset < 0.05 ? 0.01 : 0.3));
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
