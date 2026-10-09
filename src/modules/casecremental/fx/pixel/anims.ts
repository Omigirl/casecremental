import type { Key } from "./timeline";

// Every prop's animations (spec §6): an always-on idle loop, reactions and events. Frames index
// the prop's built sheet (art/manifest.json); offsets are whole pixels; idle loops have different
// lengths so nothing moves in sync.

export const ANIMS = {
  // case sheet: 0 closed, 1–2 lid lifting, 3 open
  caseIdle: [
    { frame: 0, ms: 1700 },
    { frame: 0, ms: 90, dy: -1 },
    { frame: 0, ms: 1300 },
  ],
  caseDrop: [
    { frame: 0, ms: 40, dy: -9 },
    { frame: 0, ms: 40, dy: -5 },
    { frame: 0, ms: 50, dy: -2 },
    { frame: 0, ms: 70, dy: 0, event: "land" },
    { frame: 0, ms: 60, dy: -2 },
    { frame: 0, ms: 80, dy: 0 },
  ],
  caseOpen: [
    { frame: 0, ms: 60, dy: 1 },
    { frame: 1, ms: 70, dy: -1 },
    { frame: 2, ms: 80, dy: -1 },
    { frame: 3, ms: 120, dy: 0, event: "open" },
  ],
  caseOpenIdle: [
    { frame: 3, ms: 900 },
    { frame: 3, ms: 900, dy: -1 },
  ],
  // key sheet: 0 idle, 1 glint, 2–3 turning
  keyIdle: [
    { frame: 0, ms: 2300 },
    { frame: 1, ms: 80 },
    { frame: 0, ms: 80 },
    { frame: 1, ms: 80 },
    { frame: 0, ms: 1500 },
  ],
  keyReady: [
    { frame: 0, ms: 260 },
    { frame: 0, ms: 260, dy: -1 },
    { frame: 1, ms: 80, dy: -1 },
  ],
  keyTurn: [
    { frame: 2, ms: 80 },
    { frame: 3, ms: 110, event: "turned" },
    { frame: 3, ms: 160 },
  ],
  // sell bin sheet: 0 idle, 1–3 swallowing
  binIdle: [
    { frame: 0, ms: 1100 },
    { frame: 0, ms: 1100, dy: -1 },
  ],
  binHungry: [
    { frame: 0, ms: 220 },
    { frame: 1, ms: 120 },
    { frame: 0, ms: 220, dy: -1 },
  ],
  binSwallow: [
    { frame: 1, ms: 50 },
    { frame: 2, ms: 60 },
    { frame: 3, ms: 90, event: "swallowed" },
    { frame: 0, ms: 60, dy: 1 },
    { frame: 0, ms: 80, dy: -1 },
    { frame: 0, ms: 60 },
  ],
  coinSpin: [
    { frame: 0, ms: 80 },
    { frame: 1, ms: 80 },
    { frame: 2, ms: 80 },
    { frame: 3, ms: 80 },
  ],
  // the sleeping bot breathes (sheet 0–3), eyes shut
  botSleep: [
    { frame: 0, ms: 700, eyes: "closed" },
    { frame: 1, ms: 520, eyes: "closed" },
    { frame: 2, ms: 840, eyes: "closed" },
    { frame: 1, ms: 520, eyes: "closed" },
  ],
  // the awake bot (bot-open sheet: 0 standing, 1–7 the crouch-and-hop)
  botIdle: [
    { frame: 0, ms: 1900 },
    { frame: 0, ms: 140, dy: 1 },
    { frame: 0, ms: 1100 },
  ],
  botWake: [
    { frame: 1, ms: 140, eyes: "half" },
    { frame: 2, ms: 120 },
    { frame: 3, ms: 110, dy: -1 },
    { frame: 4, ms: 120, dy: -2 },
    { frame: 5, ms: 140, dy: -1 },
    { frame: 6, ms: 120 },
    { frame: 7, ms: 160, eyes: "happy" },
    { frame: 0, ms: 200 },
  ],
  botOpen: [
    { frame: 1, ms: 90 },
    { frame: 2, ms: 80 },
    { frame: 3, ms: 80, dy: -1 },
    { frame: 4, ms: 90, dy: -2 },
    { frame: 5, ms: 90, dy: -1 },
    { frame: 6, ms: 80 },
    { frame: 7, ms: 120, eyes: "happy" },
    { frame: 0, ms: 120 },
  ],
  lampSway: [
    { frame: 0, ms: 1300 },
    { frame: 0, ms: 1250, dx: 1 },
    { frame: 0, ms: 1350 },
    { frame: 0, ms: 1200, dx: -1 },
  ],
} satisfies Record<string, readonly Key[]>;

export type AnimId = keyof typeof ANIMS;

/** Which sprite sheet each animation plays on. */
export const ANIM_SPRITE: Record<AnimId, string> = {
  caseIdle: "case-*",
  caseDrop: "case-*",
  caseOpen: "case-*",
  caseOpenIdle: "case-*",
  keyIdle: "key",
  keyReady: "key",
  keyTurn: "key",
  binIdle: "sell-bin",
  binHungry: "sell-bin",
  binSwallow: "sell-bin",
  coinSpin: "coin",
  botSleep: "bot-sleep",
  botIdle: "bot-open",
  botWake: "bot-open",
  botOpen: "bot-open",
  lampSway: "room-lamp",
};

export const loopLength = (keys: readonly Key[]): number => keys.reduce((s, k) => s + k.ms, 0);
