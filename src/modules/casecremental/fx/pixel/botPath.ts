import { BOT_STEP_SECONDS, type BotJob } from "../../sim/botSeller";
import type { TableLayout } from "./layout";

// Where the bot walks (M2b spec §3): one line along the table front — its station (home), just right of
// your mat (the bench), beside the SELL bin, and the claim tray's far end (so a card it sets aside is
// visibly carried there, not dropped where it was picked up). Each leg is walked in the
// sim's time for that step, so the bot arrives as the sim's step ends.

export interface BotStations {
  /** The table-front line it walks on (feet), world px. */
  y: number;
  home: number;
  bench: number;
  bin: number;
  tray: number;
}

export function botStations(l: TableLayout): BotStations {
  const lo = l.table.x + 6;
  const hi = l.table.x + l.table.w - 6;
  const clampX = (x: number) => Math.round(Math.min(hi, Math.max(lo, x)));
  return {
    y: l.bot.spot.y,
    home: clampX(l.bot.spot.x),
    bench: clampX(l.you.mat.x + l.you.mat.w + 12),
    bin: clampX(l.bin.x - 18),
    tray: clampX(l.tray.x + l.tray.w - 10),
  };
}

/** The station this step heads for, and the walking speed that covers its leg in the step's time. */
export function botTarget(st: BotStations, job: BotJob | null, speed: number): { x: number; pxPerSec: number } {
  const dest = job?.dest === "tray" ? st.tray : job?.dest === "bin" ? st.bin : st.bench;
  const leg = (from: number, to: number, seconds: number) => (Math.max(Math.abs(to - from), 1) / seconds) * speed;
  if (!job) return { x: st.home, pxPerSec: leg(st.bench, st.home, BOT_STEP_SECONDS.back) };
  switch (job.step) {
    case "toBench":
    case "wait":
    case "pickUp":
      return { x: st.bench, pxPerSec: leg(st.home, st.bench, BOT_STEP_SECONDS.toBench) };
    case "carry":
    case "drop":
      return { x: dest, pxPerSec: leg(st.bench, dest, BOT_STEP_SECONDS.carry) };
    case "back":
      return { x: st.home, pxPerSec: leg(dest, st.home, BOT_STEP_SECONDS.back) };
  }
}

export const stepToward = (x: number, target: number, maxStep: number): number =>
  x < target ? Math.min(target, x + maxStep) : Math.max(target, x - maxStep);
