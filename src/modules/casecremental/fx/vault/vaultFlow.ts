import type { RunState } from "../../sim/run";
import { VAULT_OPENING_SECONDS } from "../../sim/tuning";
import type { AudioEngine } from "../audio/AudioEngine";
import type { TrackId } from "../audio/sounds";
import { VAULT_CUES } from "./cues";
import { BLACKOUT_SECONDS, blackoutLevel, LIGHTS_UP_SECONDS, lightCues, lightLevels, type LightLevels } from "./lights";

// The run's end and the next run's start, for the World (rework spec §4): the blackout after the vault, the
// dark prestige screen with its music, and the workshop powering back up — light levels each frame, the
// breaker sounds on their cues, and the music handed back to the stage loop once the lights are on.

export interface MusicPlan {
  /** A named track over the stage loop, or null for the stage loop. */
  track: TrackId | null;
  loop: boolean;
  /** Where a one-shot starts (the fanfare resumes at the opening's time). */
  offset: number;
  musicOn: boolean;
}

/** What should be playing when the scene comes back from the lobby, read from the sim (the music engine
 *  only remembers where a track started, not where the vault is). */
export function musicPlan(s: Pick<RunState, "vault" | "over">, poweringUp: boolean): MusicPlan {
  const plan = (track: TrackId | null, loop = true, offset = 0, musicOn = true): MusicPlan => ({ track, loop, offset, musicOn });
  const v = s.vault;
  if (v?.phase === "key") return plan("vault-suspense");
  if (v?.phase === "opening") {
    if (v.t < VAULT_CUES.impact) return plan("vault-fanfare", false, 0, false); // silent: the World starts it at the impact
    return v.t < VAULT_OPENING_SECONDS ? plan("vault-fanfare", false, v.t - VAULT_CUES.impact) : plan(null, true, 0, false);
  }
  if (s.over) return plan("prestige");
  if (poweringUp) return plan(null, true, 0, false); // the PowerCycle turns it on when the lights are up
  return plan(null);
}

/** Apply a plan: the track is chosen while the music is still off, so turning it on starts the right one. */
export function applyMusic(audio: AudioEngine, p: MusicPlan): void {
  if (!p.musicOn) {
    audio.setMusicOn(false);
    audio.setTrack(p.track);
    return;
  }
  audio.setMusicOn(false);
  audio.setTrack(p.track, { loop: p.loop, offset: p.offset });
  audio.setMusicOn(true);
}

/** Re-apply the music from the sim when the audio finishes decoding after a reload's first gesture, and when a
 *  hidden tab comes back (the sim paused, the audio kept playing). Not while the scene is suspended. */
export function bindMusicResync(
  audio: Pick<AudioEngine, "onReady">,
  doc: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">,
  running: () => boolean,
  resume: () => void,
): () => void {
  const go = () => {
    if (running()) resume();
  };
  const onVisible = () => {
    if (doc.visibilityState === "visible") go();
  };
  const off = audio.onReady(go);
  doc.addEventListener("visibilitychange", onVisible);
  return () => {
    off();
    doc.removeEventListener("visibilitychange", onVisible);
  };
}

const all = (v: number): LightLevels => ({ room: v, lamp: v, reels: v, bin: v, leds: v });

export class PowerCycle {
  private blackoutT: number | null = null;
  private lightsT: number | null = null;
  private dark = false;
  private prestigeOn = false;

  constructor(private readonly audio: AudioEngine) {}

  /** The lights are still coming up (the music waits for them). */
  get poweringUp(): boolean {
    return this.lightsT !== null;
  }

  /** The vault has opened: fade everything to black, then the prestige music. */
  blackout(): void {
    this.blackoutT = 0;
    this.lightsT = null;
    this.prestigeOn = false;
    this.audio.play("blackout");
  }

  /** A reload on the prestige screen: already black. */
  darkNow(): void {
    this.dark = true;
    this.audio.setTrack("prestige", { loop: true });
  }

  /** The next run: the lights stutter back on in silence, then the stage loop returns. */
  powerUp(): void {
    this.blackoutT = null;
    this.dark = false;
    this.lightsT = 0;
    this.audio.setMusicOn(false); // first, so handing the track back doesn't start the loop yet
    this.audio.setTrack(null);
    this.audio.play("run-start");
  }

  update(dt: number): LightLevels {
    if (this.blackoutT !== null) {
      this.blackoutT += dt;
      if (!this.prestigeOn && this.blackoutT >= BLACKOUT_SECONDS) {
        this.prestigeOn = true;
        this.audio.setTrack("prestige", { loop: true });
      }
      return all(blackoutLevel(this.blackoutT));
    }
    if (this.dark) return all(0);
    if (this.lightsT !== null) {
      const prev = this.lightsT;
      this.lightsT += dt;
      for (const c of lightCues) if (prev < c.at && this.lightsT >= c.at) this.audio.play(c.sound);
      if (this.lightsT < LIGHTS_UP_SECONDS) return lightLevels(this.lightsT);
      this.lightsT = null;
      this.audio.setMusicOn(true);
    }
    return all(1);
  }
}
