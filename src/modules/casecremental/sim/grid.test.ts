import { describe, expect, it } from "vitest";
import { gridSize, gridStalled } from "./grid";
import { DEFAULT_SETUP, Run, type SimEvent } from "./run";
import { GRID_BUY_INTERVALS, GRID_COST, GRID_OPEN_SECONDS, SELLER_COST } from "./tuning";
import type { Drop } from "./types";

const run3 = (cash = 1e12) => {
  const r = new Run(11, { ...DEFAULT_SETUP, run: 3, startCash: cash });
  r.buySeller();
  r.setSellerThreshold("classified");
  return r;
};
const tickFor = (r: Run, s: number) => {
  for (let i = 0; i < Math.round(s * 30); i++) r.tick(1 / 30);
};
const filler = (id: number): Drop => ({
  id,
  caseId: "bootcamp",
  skinId: "bc_warlord",
  rarity: "covert",
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
});

describe("the auto-buyer grid", () => {
  it("is a Run 3 machine that needs the auto-seller", () => {
    expect(new Run(1, { ...DEFAULT_SETUP, run: 2, startCash: 1e12 }).buyGrid().ok).toBe(false);
    const r = new Run(1, { ...DEFAULT_SETUP, run: 3, startCash: 1e12 });
    expect(r.buyGrid()).toEqual({ ok: false, reason: "buy the auto-seller first" });
    r.buySeller();
    expect(r.buyGrid().ok).toBe(true);
    expect(r.state.grid.cells).toHaveLength(gridSize(0));
  });

  it("buys ticked cases round-robin into its cells and opens each after a delay", () => {
    const r = run3();
    r.unlockCase("wildwood");
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    r.toggleGridTick("wildwood");
    tickFor(r, GRID_BUY_INTERVALS[0] * 4 + 0.05);
    const events = r.drainEvents();
    // a delivered cell empties, so the purchase order is read from the events, not the board
    const filled = events.flatMap((e) => (e.type === "gridFilled" ? [e.caseId] : []));
    expect(filled.slice(0, 4)).toEqual(["bootcamp", "wildwood", "bootcamp", "wildwood"]);
    expect(events.some((e) => e.type === "gridOpened")).toBe(true);
    // the first purchase opened GRID_OPEN_SECONDS after it was filled, not before
    const firstOpen = events.find((e) => e.type === "gridOpened");
    expect(firstOpen).toMatchObject({ cell: 0 });
  });

  it("never spends below its reserve", () => {
    const r = run3(SELLER_COST + GRID_COST + 100);
    r.buyGrid(); // 100 left
    r.setGridReserve(0.75);
    r.toggleGridTick("bootcamp");
    tickFor(r, 30);
    expect(r.state.cash).toBeGreaterThan(0);
    const events = r.drainEvents();
    expect(events.some((e) => e.type === "gridFilled")).toBe(true);
    for (const e of events) if (e.type === "gridFilled") expect(e.caseId).toBe("bootcamp");
  });

  it("waits while the case costs more than its budget", () => {
    const r = run3(SELLER_COST + GRID_COST + 7);
    r.buyGrid(); // 7 left: a 2-coin Boot Camp case is more than 25 % of it
    r.setGridReserve(0.75);
    r.toggleGridTick("bootcamp");
    tickFor(r, 5);
    expect(r.drainEvents().some((e) => e.type === "gridFilled")).toBe(false);
    expect(r.state.cash).toBe(7);
  });

  it("stalls with a full tray, keeps its drops, and resumes when the tray has room", () => {
    const r = run3();
    r.setSellerThreshold("milspec");
    r.setCollect(null);
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    r.state.tray = Array.from({ length: r.setup.trayCapacity }, (_, i) => filler(9000 + i));
    // tick until a drop the seller won't sell (above Mil-Spec) opens into the full tray
    let stalledOpen: SimEvent | undefined;
    for (let i = 0; i < 30 * 120 && !stalledOpen; i++) {
      r.tick(1 / 30);
      stalledOpen = r.drainEvents().find((e) => e.type === "gridOpened" && e.drop.rarity !== "milspec");
    }
    expect(stalledOpen).toBeDefined();
    expect(gridStalled(r.state.grid)).toBe(true);
    tickFor(r, 5); // the cells filled before the stall open; nothing new is bought
    const after = r.drainEvents();
    expect(after.some((e) => e.type === "gridFilled")).toBe(false);
    const stalled = r.state.grid.cells.flatMap((c) => (c?.drop ? [c.drop.id] : []));
    expect(stalled.length).toBeGreaterThan(0);
    expect(r.state.grid.cells.every((c) => c === null || c.drop !== null)).toBe(true); // only stalled cells remain
    for (let i = 0; i < stalled.length; i++) expect(r.claim(0).ok).toBe(true);
    tickFor(r, 0.2);
    expect(gridStalled(r.state.grid)).toBe(false);
    const stored = r.drainEvents().flatMap((e) => (e.type === "stored" && e.from === "grid" ? [e.drop.id] : []));
    expect(stored.sort()).toEqual([...stalled].sort());
    tickFor(r, GRID_BUY_INTERVALS[0] + 0.1);
    expect(r.drainEvents().some((e) => e.type === "gridFilled")).toBe(true); // buying again
  });

  it("delivers through the auto-seller's rules: sells at or below the threshold", () => {
    const r = run3();
    r.setSellerThreshold("gold");
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, 5);
    const sold = r.drainEvents().filter((e) => e.type === "sold");
    expect(sold.length).toBeGreaterThan(0);
    for (const e of sold) expect(e).toMatchObject({ source: "seller", from: "grid" });
  });

  it("grows its cells and keeps the filled ones", () => {
    const r = run3();
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, 2.1);
    const filled = r.state.grid.cells.filter(Boolean).length;
    expect(filled).toBeGreaterThan(0);
    expect(r.buyGridSize().ok).toBe(true);
    expect(r.state.grid.cells).toHaveLength(gridSize(1));
    expect(r.state.grid.cells.filter(Boolean).length).toBe(filled);
  });

  it("its reveals heat the run, and never feed the combo", () => {
    const r = run3();
    r.buyGrid();
    r.buyGridRate();
    r.buyGridRate();
    r.buyGridSize();
    r.toggleGridTick("bootcamp");
    tickFor(r, 40);
    expect(r.state.combo).toBe(0);
    expect(r.state.heat).toBeGreaterThan(1);
  });

  it("only ticks an unlocked case of this run, and only takes a listed reserve", () => {
    const r = run3();
    expect(r.toggleGridTick("wildwood").ok).toBe(false); // locked
    expect(r.toggleGridTick("nowhere").ok).toBe(false);
    expect(r.toggleGridTick("bootcamp").ok).toBe(true);
    expect(r.state.grid.ticks).toEqual(["bootcamp"]);
    expect(r.toggleGridTick("bootcamp").ok).toBe(true);
    expect(r.state.grid.ticks).toEqual([]);
    expect(r.setGridReserve(0.3).ok).toBe(false);
    expect(r.setGridReserve(0.25).ok).toBe(true);
    expect(r.state.grid.reserve).toBe(0.25);
  });

  it("the vault refunds unopened cells and cashes in stalled drops", () => {
    const r = run3();
    for (const id of ["wildwood", "bedrock", "mainframe", "neon", "deepspace", "inferno"]) r.unlockCase(id);
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, GRID_BUY_INTERVALS[0] * 3 + 0.05);
    expect(r.state.grid.cells.some((c) => c && !c.drop && c.t < GRID_OPEN_SECONDS)).toBe(true);
    const cash = r.state.cash;
    const earned = r.state.lifetimeEarnings;
    expect(r.buyVault().ok).toBe(true);
    expect(r.state.grid.cells.every((c) => c === null)).toBe(true);
    expect(r.state.cash).toBeGreaterThan(cash - r.setup.vaultPrice);
    expect(r.state.lifetimeEarnings).toBe(earned); // a refund is not earnings
    expect(r.buyGridRate().ok).toBe(false);
    r.drainEvents();
    tickFor(r, 3);
    expect(r.drainEvents().some((e) => e.type === "gridFilled")).toBe(false); // the grid has stopped
  });

  it("the vault cashes a stalled drop in as a sale", () => {
    const r = run3();
    for (const id of ["wildwood", "bedrock"]) r.unlockCase(id);
    r.setSellerThreshold("milspec");
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    r.state.tray = Array.from({ length: r.setup.trayCapacity }, (_, i) => filler(9000 + i));
    for (let i = 0; i < 30 * 120 && !gridStalled(r.state.grid); i++) r.tick(1 / 30);
    expect(gridStalled(r.state.grid)).toBe(true);
    r.drainEvents();
    const earned = r.state.lifetimeEarnings;
    expect(r.buyVault().ok).toBe(true);
    const sales = r.drainEvents().filter((e) => e.type === "sold" && e.from === "grid");
    expect(sales.length).toBeGreaterThan(0);
    expect(sales.every((e) => e.type === "sold" && e.source === "grid")).toBe(true);
    expect(r.state.lifetimeEarnings).toBeGreaterThan(earned);
  });

  it("a snapshot mid-run resumes the same", () => {
    const r = run3();
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, 3.3);
    const back = Run.fromSnapshot(structuredClone(r.snapshot()));
    tickFor(r, 4);
    tickFor(back, 4);
    expect(back.state.grid).toEqual(r.state.grid);
    expect(back.state.cash).toBe(r.state.cash);
  });
});
