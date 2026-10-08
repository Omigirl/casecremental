import { describe, expect, it } from "vitest";
import { BOT_STEP_SECONDS, type BotJob } from "../../sim/botSeller";
import { botStations, botTarget, stepToward } from "./botPath";
import { tableLayout } from "./layout";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [1000, 1000],
  [390, 844],
  [360, 640],
];
const job = (over: Partial<BotJob>): BotJob => ({ step: "toBench", t: 0, drop: null, dest: null, ...over });

describe("the bot's path along the table front", () => {
  it.each(SIZES)("keeps every station on the table at %ix%i", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    const st = botStations(l);
    for (const x of [st.home, st.bench, st.bin, st.tray]) {
      expect(x).toBeGreaterThanOrEqual(l.table.x);
      expect(x).toBeLessThanOrEqual(l.table.x + l.table.w);
    }
    expect(st.bench).toBeGreaterThan(l.you.mat.x + l.you.mat.w);
  });

  it("heads for the station each step needs", () => {
    const st = botStations(tableLayout(pixelViewport(1920, 1080)));
    expect(botTarget(st, null, 1).x).toBe(st.home);
    expect(botTarget(st, job({ step: "toBench" }), 1).x).toBe(st.bench);
    expect(botTarget(st, job({ step: "wait" }), 1).x).toBe(st.bench);
    expect(botTarget(st, job({ step: "carry", dest: "tray" }), 1).x).toBe(st.tray);
    expect(botTarget(st, job({ step: "drop", dest: "bin" }), 1).x).toBe(st.bin);
    expect(botTarget(st, job({ step: "back", dest: "bin" }), 1).x).toBe(st.home);
  });

  it("walks each leg in the sim's time for it, faster with Speed", () => {
    const st = botStations(tableLayout(pixelViewport(1920, 1080)));
    for (const speed of [1, 8]) {
      const t = botTarget(st, job({ step: "toBench" }), speed);
      let x = st.home;
      const dt = 1 / 60;
      let secs = 0;
      while (x !== t.x && secs < 10) {
        x = stepToward(x, t.x, t.pxPerSec * dt);
        secs += dt;
      }
      expect(secs).toBeCloseTo(BOT_STEP_SECONDS.toBench / speed, 1);
    }
  });

  it("never overshoots", () => {
    expect(stepToward(10, 12, 5)).toBe(12);
    expect(stepToward(10, 4, 5)).toBe(5);
    expect(stepToward(10, 10, 5)).toBe(10);
  });

  it("after a reload mid-carry, puts the bot on its carry leg toward the tray (Review Focus 1)", () => {
    const st = botStations(tableLayout(pixelViewport(1280, 720)));
    const carrying = job({
      step: "carry",
      t: 0.6,
      dest: "tray",
      drop: { id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "covert", float: 0.2, wear: "FT", statTrak: false, value: 1 },
    });
    const t = botTarget(st, carrying, 1);
    expect(t.x).toBe(st.tray);
    expect(t.pxPerSec).toBeGreaterThan(0);
  });
});
