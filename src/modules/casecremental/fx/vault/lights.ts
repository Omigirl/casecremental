// The end of a run and the start of the next (rework spec §4): a smooth blackout, then an old workshop
// powering back up — each light source stutters on at its own moment.

export interface LightLevels {
  room: number;
  lamp: number;
  reels: number;
  bin: number;
  leds: number;
}

export const BLACKOUT_SECONDS = 2.5;
export const LIGHTS_UP_SECONDS = 4.2;

/** 1 (lit) → 0 (black), eased. */
export function blackoutLevel(t: number): number {
  const x = Math.min(1, Math.max(0, t / BLACKOUT_SECONDS));
  return 1 - x * x * (3 - 2 * x);
}

/** A source that stutters on from `start`: off/on blips over `flicker` seconds, then steady. */
function stutter(t: number, start: number, flicker: number): number {
  if (t < start) return 0;
  if (t >= start + flicker) return 1;
  const k = (t - start) / flicker;
  const blip = Math.floor(k * 9);
  return [1, 0, 1, 1, 0, 0, 1, 0, 1][blip] ?? 1;
}

/** The room's main light: a slow ramp, dim while the lamp warms up, then from ROOM_FROM it flickers up to full over
 *  ROOM_FLICKER seconds — a few soft dips, never a hard step (a frame moves it by a few percent at most). */
const ROOM_DIM = 0.4;
const ROOM_FROM = 1.4;
const ROOM_FLICKER = 0.5;
const ROOM_DIPS = 3;
const ROOM_DIP = 0.3;

function roomLevel(t: number): number {
  const ramp = Math.min(1, Math.max(0, (t - 0.5) / (LIGHTS_UP_SECONDS - 0.5)));
  const u = Math.min(1, Math.max(0, (t - ROOM_FROM) / ROOM_FLICKER));
  const rise = u * u * (3 - 2 * u);
  const dip = ROOM_DIP * (1 - u) * Math.sin(Math.PI * ROOM_DIPS * u) ** 2;
  return ramp * Math.max(0, ROOM_DIM + (1 - ROOM_DIM) * rise - dip);
}

export function lightLevels(t: number): LightLevels {
  if (t >= LIGHTS_UP_SECONDS) return { room: 1, lamp: 1, reels: 1, bin: 1, leds: 1 };
  return {
    lamp: stutter(t, 0.5, 0.9),
    reels: stutter(t, 1.5, 0.6),
    bin: stutter(t, 2.3, 0.5),
    leds: stutter(t, 2.9, 0.4),
    room: roomLevel(t),
  };
}

/** When the power-up's sounds play. */
export const lightCues: Array<{ at: number; sound: "light-flicker" | "light-on" }> = [
  { at: 0.2, sound: "light-on" },
  { at: 0.5, sound: "light-flicker" },
  { at: 1.5, sound: "light-flicker" },
  { at: 2.3, sound: "light-on" },
  { at: 2.9, sound: "light-flicker" },
];
