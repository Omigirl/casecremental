// The game's sounds (spec §9): every effect, its bus and level, and how many generated variants it
// has. Files live in assets/audio as <id>-<n>.mp3 (variants) and music-<stage>.mp3 (loops); a
// sound with no files yet simply stays silent.

export type Bus = "sfx" | "ui";

export const SOUNDS = {
  "case-latch": { bus: "sfx", gain: 0.8 },
  "key-turn": { bus: "sfx", gain: 0.8 },
  "lid-creak": { bus: "sfx", gain: 0.6 },
  "reel-tick": { bus: "sfx", gain: 0.35 },
  "reel-stop": { bus: "sfx", gain: 0.9 },
  "reveal-chime": { bus: "sfx", gain: 0.7 },
  "covert-impact": { bus: "sfx", gain: 1 },
  "jackpot-swell": { bus: "sfx", gain: 1 },
  "coin-clink": { bus: "sfx", gain: 0.55 },
  "coin-cascade": { bus: "sfx", gain: 0.8 },
  "cash-register": { bus: "sfx", gain: 0.7 },
  "bot-servo": { bus: "sfx", gain: 0.6 },
  "ui-click": { bus: "ui", gain: 0.6 },
  "panel-open": { bus: "ui", gain: 0.6 },
  "bot-reel-spin": { bus: "sfx", gain: 0.45 },
  "bot-wake": { bus: "sfx", gain: 0.7, maxSeconds: 1.6 },
  "seller-power-on": { bus: "sfx", gain: 0.8 },
  "seller-sell": { bus: "sfx", gain: 0.6, maxSeconds: 1.2 },
  "dayjob-work": { bus: "sfx", gain: 0.6 },
  "dayjob-pay": { bus: "sfx", gain: 0.7 },
  "dayjob-nopay": { bus: "sfx", gain: 0.7 },
  "tray-store": { bus: "sfx", gain: 0.6 },
  "stage-up": { bus: "sfx", gain: 0.85 },
  "vault-slam": { bus: "sfx", gain: 1 },
  "vault-rumble": { bus: "sfx", gain: 0.9, maxSeconds: 3.5 },
  "devil-key-whisper": { bus: "sfx", gain: 0.6 },
  "devil-key-laugh": { bus: "sfx", gain: 0.8 },
  "coin-fountain": { bus: "sfx", gain: 0.8 },
  firework: { bus: "sfx", gain: 0.7, maxSeconds: 1.8 },
  "legendary-choir": { bus: "sfx", gain: 1 },
  blackout: { bus: "sfx", gain: 0.9 },
  "light-flicker": { bus: "sfx", gain: 0.6, maxSeconds: 2 },
  "light-on": { bus: "sfx", gain: 0.7, maxSeconds: 1 },
  "charm-pick": { bus: "ui", gain: 0.7 },
  "perk-buy": { bus: "ui", gain: 0.7 },
  "run-start": { bus: "sfx", gain: 0.8, maxSeconds: 1.8 },
  "vault-open-hit": { bus: "sfx", gain: 1, maxSeconds: 2.5 },
  "reward-chime": { bus: "sfx", gain: 0.8 },
  "count-tick": { bus: "sfx", gain: 0.35, maxSeconds: 0.3 },
  "count-ding": { bus: "sfx", gain: 0.8 },
  // Runs 2–3 (M3): gains set from the measured mean levels against seller-power-on / tray-store.
  "locker-power-on": { bus: "sfx", gain: 0.15 },
  "locker-store": { bus: "sfx", gain: 0.45 },
  "tradeup-press": { bus: "sfx", gain: 0.4 },
  "tradeup-reveal": { bus: "sfx", gain: 0.45 },
} as const satisfies Record<string, { bus: Bus; gain: number; maxSeconds?: number }>;

export type SoundId = keyof typeof SOUNDS;

/** The generator ignored requested lengths, so a long effect is cut (with a short fade) after this many seconds. */
export function maxSecondsOf(id: SoundId): number | undefined {
  return (SOUNDS[id] as { maxSeconds?: number }).maxSeconds;
}

/** The vaults' fanfares: Vault I's, then Vaults II's and III's (Vault I's re-cut +2 and +4 semitones, plan M3-C). */
export type FanfareId = "vault-fanfare" | "vault-fanfare-2" | "vault-fanfare-3";

/** Named music that replaces the stage loop: the vault's suspense, its intro (from the key turn to the impact) and
 *  the vault's fanfare, the prestige loop. */
export type TrackId = "vault-suspense" | "vault-intro" | FanfareId | "prestige";

/** The music bus runs this much above its slider (user: "make music louder" — the generated music sat well under
 *  the effects); the master compressor keeps the peaks in check. */
export const MUSIC_BOOST = 1.6;
/** Each named track's level on the music bus: the intro and the fanfare's drop ride over everything; the re-cut
 *  fanfares are within 1 dB of Vault I's (plan M3-C), so they ride at its level. */
export const TRACK_GAIN: Readonly<Record<TrackId, number>> = {
  "vault-suspense": 1.2,
  "vault-intro": 1.4,
  "vault-fanfare": 1.5,
  "vault-fanfare-2": 1.5,
  "vault-fanfare-3": 1.5,
  prestige: 1,
};

export interface AudioFiles {
  /** variant URLs per sound */
  sfx: Map<SoundId, string[]>;
  /** loop URL per intensity stage */
  music: Map<number, string>;
  /** one URL per named track (the first take wins) */
  tracks: Map<TrackId, string>;
}

/** Group file URLs by name: "reel-tick-2.mp3" → reel-tick variant, "music-1.mp3" → stage 1 loop. */
export function indexAudio(urls: Record<string, string>): AudioFiles {
  const sfx = new Map<SoundId, string[]>();
  const music = new Map<number, string>();
  const tracks = new Map<TrackId, string>();
  for (const [path, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
    const name = path
      .split("/")
      .pop()!
      .replace(/\.mp3$/, "");
    const stage = /^music-(\d+)$/.exec(name);
    if (stage) {
      music.set(Number(stage[1]), url);
      continue;
    }
    // vault-fanfare-2 / -3 are Vaults II and III's own fanfares (tried before vault-fanfare, so they are never a
    // spare take of Vault I's); a numbered file of any other track is a take of it
    const track = /^(vault-suspense|vault-intro|vault-fanfare-[23]|vault-fanfare|prestige)(?:-(\d+))?$/.exec(name);
    if (track) {
      const trackId = track[1] as TrackId;
      if (!tracks.has(trackId)) tracks.set(trackId, url); // sorted, so a take -1 wins over a spare
      continue;
    }
    const id = name.replace(/-\d+$/, "");
    if (id in SOUNDS) sfx.set(id as SoundId, [...(sfx.get(id as SoundId) ?? []), url]);
  }
  return { sfx, music, tracks };
}
