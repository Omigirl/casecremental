import { describe, expect, it } from "vitest";
import type { SimEvent } from "../sim/run";
import { GameController, MAX_FRAME_SECONDS } from "./controller";

describe("GameController", () => {
  it("advances the sim in fixed steps", () => {
    const c = new GameController(1);
    for (let i = 0; i < 60; i++) c.step(1 / 60);
    expect(c.run.state.time).toBeGreaterThan(0.95);
    expect(c.run.state.time).toBeLessThan(1.05);
  });

  it("clamps a huge frame (tab was hidden) to MAX_FRAME_SECONDS", () => {
    const c = new GameController(1);
    c.act({ type: "buyCase", caseId: "bootcamp" });
    c.act({ type: "insertKey" });
    c.step(30);
    expect(c.run.state.time).toBeLessThanOrEqual(MAX_FRAME_SECONDS);
    expect(c.run.state.bench.phase).toBe("spinning");
  });

  it("freezes the sim at timeScale 0 (hit-stop)", () => {
    const c = new GameController(1);
    c.timeScale = 0;
    c.step(0.1);
    expect(c.run.state.time).toBe(0);
  });

  it("routes actions to the run and events to listeners", () => {
    const c = new GameController(1);
    const seen: SimEvent[] = [];
    const off = c.onEvent((e) => seen.push(e));
    expect(c.act({ type: "buyCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.act({ type: "sell" }).ok).toBe(false);
    off();
    c.act({ type: "insertKey" });
    expect(seen.map((e) => e.type)).toEqual(["caseBought"]);
  });

  it("refreshes the view and notifies subscribers on act", () => {
    const c = new GameController(1);
    let calls = 0;
    c.subscribe(() => calls++);
    const before = c.getView();
    c.act({ type: "buyCase", caseId: "bootcamp" });
    expect(calls).toBe(1);
    expect(c.getView()).not.toBe(before);
    expect(c.getView().phase).toBe("locked");
  });
});
