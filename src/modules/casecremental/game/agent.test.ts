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

  it("documents every action", () => {
    const api = createAgentApi(new GameController(1));
    expect(Object.keys(api.describeActions ?? {}).sort()).toEqual(Object.keys(api.actions ?? {}).sort());
  });
});
