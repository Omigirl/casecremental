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
  /** Where a one-shot starts (the intro and the fanfare resume at the opening's time). */
  offset: number;
  musicOn: boolean;
}

/** Where the lights are: the blackout still falling, black (the prestige screen), the workshop powering back
 *  up, or lit. */
export type PowerPhase = "blackout" | "dark" | "powerUp" | "lit";

/** What the music needs from the audio engine (a recorder stands in for it in the tests). */
export type MusicAudio = Pick<AudioEngine, "play" | "setMusicOn" | "setTrack">;

/** What should be playing, read from the sim and the lights (the music engine only remembers where a track
 *  started, not where the vault is): on a reload, back from the lobby, and whenever the World restores a run. */
export function musicPlan(s: Pick<RunState, "vault" | "over">, power: PowerPhase): MusicPlan {
  const plan = (track: TrackId | null, loop = true, offset = 0, musicOn = true): MusicPlan => ({ track, loop, offset, musicOn });
  const v = s.vault;
  if (v?.phase === "key") return plan("vault-suspense");
  if (v?.phase === "opening") {
    // the intro from the key turn; on the impact the scene hands over to the fanfare (its first downbeat)
    if (v.t < VAULT_CUES.impact) return plan("vault-intro", false, v.t);
    return v.t < VAULT_OPENING_SECONDS ? plan("vault-fanfare", false, v.t - VAULT_CUES.impact) : plan(null, true, 0, false);
  }
  // the prestige loop waits for the dark: the PowerCycle turns it on when the blackout has fallen
  if (s.over) return power === "blackout" ? plan("prestige", true, 0, false) : plan("prestige");
  if (power === "powerUp") return plan(null, true, 0, false); // the PowerCycle turns it on when the lights are up
  return plan(null);
}

/** Apply a plan: the track is chosen while the music is still off, so turning it on starts the right one. A
 *  silent plan arms its track as planned (a one-shot stays a one-shot), and whoever turns the music on starts it. */
export function applyMusic(audio: MusicAudio, p: MusicPlan): void {
  audio.setMusicOn(false);
  audio.setTrack(p.track, { loop: p.loop, offset: p.offset });
  if (p.musicOn) audio.setMusicOn(true);
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

  constructor(private readonly audio: MusicAudio) {}

  /** Where the lights are (the music waits for the dark, and for the lights to come up). */
  get phase(): PowerPhase {
    if (this.blackoutT !== null) return this.prestigeOn ? "dark" : "blackout";
    if (this.dark) return "dark";
    return this.lightsT !== null ? "powerUp" : "lit";
  }

  /** The vault has opened: fade everything to black, then the prestige music. */
  blackout(): void {
    this.blackoutT = 0;
    this.lightsT = null;
    this.prestigeOn = false;
    this.audio.play("blackout");
  }

  /** A reload on the prestige screen: already black (musicPlan picks the prestige loop). */
  darkNow(): void {
    this.dark = true;
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
        // on as well: a lobby trip during the fade left the music off, the prestige loop armed (musicPlan)
        this.audio.setTrack("prestige", { loop: true });
        this.audio.setMusicOn(true);
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
