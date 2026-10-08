// The game's sounds (spec §9): every effect, its bus and level, and how many generated variants it
// has. Files live in assets/audio as <id>-<n>.mp3 (variants) and music-<stage>.mp3 (loops); a
// sound with no files yet simply stays silent.

export type Bus = "sfx" | "ui";

export const SOUNDS = {
  "case-latch": { bus: "sfx", gain: 0.8 },
  "key-turn": { bus: "sfx", gain: 0.8 },
  "lid-creak": { bus: "sfx", gain: 0.6 },
  "reel-tick": { bus: "sfx", gain: 0.35 },
  "brake-thud": { bus: "sfx", gain: 0.9 },
  "reveal-chime": { bus: "sfx", gain: 0.7 },
  "covert-impact": { bus: "sfx", gain: 1 },
  "jackpot-swell": { bus: "sfx", gain: 1 },
  "coin-clink": { bus: "sfx", gain: 0.55 },
  "coin-cascade": { bus: "sfx", gain: 0.8 },
  "cash-register": { bus: "sfx", gain: 0.7 },
  "stage-whoosh": { bus: "sfx", gain: 0.8 },
  "bot-servo": { bus: "sfx", gain: 0.6 },
  "bot-beep": { bus: "sfx", gain: 0.5 },
  "ui-click": { bus: "ui", gain: 0.6 },
  "panel-open": { bus: "ui", gain: 0.6 },
} as const satisfies Record<string, { bus: Bus; gain: number }>;

export type SoundId = keyof typeof SOUNDS;

export interface AudioFiles {
  /** variant URLs per sound */
  sfx: Map<SoundId, string[]>;
  /** loop URL per intensity stage */
  music: Map<number, string>;
}

/** Group file URLs by name: "reel-tick-2.mp3" → reel-tick variant, "music-1.mp3" → stage 1 loop. */
export function indexAudio(urls: Record<string, string>): AudioFiles {
  const sfx = new Map<SoundId, string[]>();
  const music = new Map<number, string>();
  for (const [path, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
    const name = path.split("/").pop()!.replace(/\.mp3$/, "");
    const stage = /^music-(\d+)$/.exec(name);
    if (stage) {
      music.set(Number(stage[1]), url);
      continue;
    }
    const id = name.replace(/-\d+$/, "");
    if (id in SOUNDS) sfx.set(id as SoundId, [...(sfx.get(id as SoundId) ?? []), url]);
  }
  return { sfx, music };
}
