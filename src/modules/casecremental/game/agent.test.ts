import { describe, expect, it } from "vitest";
import { START_CASH } from "../sim/tuning";
import { createAgentApi } from "./agent";
import { GameController } from "./controller";

describe("agent surface", () => {
  it("publishes a cheap JSON state with the running flags", () => {
    const c = new GameController(1);
    const api = createAgentApi(c);
    const state = api.state() as Record<string, unknown>;
    expect(state).toMatchObject({ mounted: false, playing: false, cash: START_CASH, stage: 1 });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("drives the game through the controller", async () => {
    const c = new GameController(1);
    const api = createAgentApi(c);
    await api.actions!.buyCase!({ caseId: "bootcamp" });
    await api.actions!.insertKey!({});
    expect(c.run.state.bench.phase).toBe("spinning");
    const state = api.state() as { bench: { phase: string } };
    expect(state.bench.phase).toBe("spinning");
  });

  it("rejects unknown upgrade ids with the valid list", async () => {
    const api = createAgentApi(new GameController(1));
    await expect(api.actions!.buyUpgrade!({ id: "wings" })).rejects.toThrow(/luck, appraiser, quickHands, multiOpen/);
  });

  it("rejects a non-integer sell slot with a clear message", async () => {
    const api = createAgentApi(new GameController(1));
    await expect(api.actions!.sell!({ slot: 1.5 })).rejects.toThrow(/slot must be a whole number/);
    await expect(api.actions!.sell!({ slot: "left" })).rejects.toThrow(/slot must be a whole number/);
  });

  it("reports the spinning reels and each case's BUY count and total charge", async () => {
    const c = new GameController(1);
    c.run.state.upgrades.multiOpen = 1;
    c.run.state.cash = 1000;
    const api = createAgentApi(c);
    const before = api.state() as { cases: Array<{ id: string; count: number; charge: number }>; bench: { reels?: number } };
    expect(before.cases[0]).toEqual({ id: "bootcamp", count: 2, charge: 4 });
    await api.actions!.buyCase!({ caseId: "bootcamp" });
    await api.actions!.insertKey!({});
    const after = api.state() as { bench: { phase: string; reels: number } };
    expect(after.bench).toMatchObject({ phase: "spinning", reels: 2 });
  });

  it("reports the auto-buyer grid and checks its reserve", async () => {
    const c = new GameController(1);
    const api = createAgentApi(c);
    expect((api.state() as { grid: unknown }).grid).toEqual({ on: false, size: 10, filled: 0, stalled: false, ticks: [], reserve: 0.5 });
    await expect(api.actions!.setGridReserve!({ reserve: 0.4 })).rejects.toThrow(/0.25, 0.5, 0.75/);
    expect(await api.actions!.setGridReserve!({ reserve: 0.25 })).toEqual({ ok: true });
    expect(await api.actions!.toggleGridTick!({ caseId: "bootcamp" })).toEqual({ ok: true });
    expect((api.state() as { grid: { ticks: string[]; reserve: number } }).grid).toMatchObject({ ticks: ["bootcamp"], reserve: 0.25 });
  });

  it("documents every action", () => {
    const api = createAgentApi(new GameController(1));
    expect(Object.keys(api.describeActions ?? {}).sort()).toEqual(Object.keys(api.actions ?? {}).sort());
  });
});
