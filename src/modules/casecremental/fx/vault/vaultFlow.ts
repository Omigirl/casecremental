import type { AudioEngine } from "../audio/AudioEngine";
import { BLACKOUT_SECONDS, blackoutLevel, LIGHTS_UP_SECONDS, lightCues, lightLevels, type LightLevels } from "./lights";

// The run's end and the next run's start, for the World (rework spec §4): the blackout after the vault, the
// dark prestige screen with its music, and the workshop powering back up — light levels each frame, the
// breaker sounds on their cues, and the music handed back to the stage loop once the lights are on.

const all = (v: number): LightLevels => ({ room: v, lamp: v, reels: v, bin: v, leds: v });

export class PowerCycle {
  private blackoutT: number | null = null;
  private lightsT: number | null = null;
  private dark = false;
  private prestigeOn = false;

  constructor(private readonly audio: AudioEngine) {}

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
