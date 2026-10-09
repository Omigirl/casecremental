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

  it("documents every action", () => {
    const api = createAgentApi(new GameController(1));
    expect(Object.keys(api.describeActions ?? {}).sort()).toEqual(Object.keys(api.actions ?? {}).sort());
  });
});
