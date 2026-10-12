import { describe, expect, it } from "vitest";
import { buildView } from "../game/view";
import { freshMeta, setupFor } from "../sim/meta";
import { Run } from "../sim/run";
import {
  acknowledge,
  afterEvent,
  cardText,
  closeCard,
  currentStep,
  FRESH_TUTORIAL,
  NEW_RUN_CARDS,
  parseTutorial,
  replay,
  seed,
  settle,
  skip,
  whatToShow,
  type StepId,
  type TutorialProgress,
} from "./tutorialRules";

const P = (done: StepId[] = [], more: Partial<TutorialProgress> = {}): TutorialProgress => ({ done, off: false, cards: [], ...more });
const step = (p: TutorialProgress, run: Run) => currentStep(p, buildView(run));
const INTRO: StepId[] = ["buy", "key", "sell"];
const reveal = (run: Run) => {
  run.buyCase("bootcamp");
  run.insertKey();
  for (let i = 0; i < 600 && run.state.bench.phase === "spinning"; i++) run.tick(1 / 30);
};
const runOf = (n: number) => new Run(1, setupFor({ ...freshMeta(), loops: n - 1 }));
/** Every event so far, through afterEvent. */
const feed = (p: TutorialProgress, run: Run) => run.drainEvents().reduce(afterEvent, p);

describe("the tutorial's bench loop", () => {
  it("walks a new player through buy, key and sell, in order, each ending on the player's action", () => {
    const run = new Run(1);
    let p = seed(buildView(run));
    expect(p).toEqual(FRESH_TUTORIAL);
    expect(step(p, run)).toEqual({ id: "buy", text: "tut.buy", targets: ["case:bootcamp", "drawer:cases"], ok: false });
    run.buyCase("bootcamp");
    p = settle(p, buildView(run));
    expect(step(p, run)).toMatchObject({ id: "key", targets: ["world:bench"] });
    run.insertKey();
    p = settle(p, buildView(run));
    expect(step(p, run)).toBeNull(); // spinning: the sell bubble waits for the card
    for (let i = 0; i < 600 && run.state.bench.phase === "spinning"; i++) run.tick(1 / 30);
    expect(step(p, run)).toMatchObject({ id: "sell", targets: ["world:card"] });
    run.setHeld("bench", 0);
    expect(step(p, run)!.targets).toEqual(["world:bin"]); // the card is up: point at the bin
    run.sell(0);
    p = feed(p, run);
    expect(p.done).toEqual(INTRO);
  });

  it("holds every later step until the bench loop is done", () => {
    const run = new Run(1);
    run.state.cash = 1e12;
    expect(step(P(), run)).toMatchObject({ id: "buy" });
    expect(step(P(["buy"]), run)).toBeNull(); // the bench is empty: no key to turn, and nothing jumps the queue
  });

  it("ends step 3 however the card leaves the bench: the auto-seller's sale or a store to the tray (Review Focus 3)", () => {
    const run = new Run(1);
    run.state.cash = 1e12;
    run.buySeller();
    let p = P(["buy", "key"]);
    reveal(run); // no hand sale anywhere in this test: only the machine moves the card
    for (let i = 0; i < 900 && run.state.bench.phase === "revealed"; i++) run.tick(1 / 30);
    expect(run.state.bench.phase).not.toBe("revealed");
    p = feed(p, run);
    expect(p.done).toContain("sell");
  });
});

describe("the later steps", () => {
  it("wait until they can be done, then show in the spec's order, each pointing through its tab", () => {
    const run = new Run(1);
    run.state.cash = 0;
    const intro = P(INTRO);
    expect(step(intro, run)).toBeNull();
    run.state.cash = 1e12;
    const v = buildView(run);
    const cheapest = v.upgrades.filter((u) => u.canBuy).sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0]!;
    expect(step(intro, run)).toEqual({
      id: "upgrades",
      text: "tut.upgrades",
      targets: [`upgrade:${cheapest.id}`, "tab:you", "drawer:upgrades"],
      ok: false,
    });
    expect(step(P([...INTRO, "upgrades"]), run)).toMatchObject({ id: "unlock", targets: [`case:${v.cases[1]!.id}`, "drawer:cases"] });
    expect(step(P([...INTRO, "upgrades", "unlock"]), run)).toMatchObject({ id: "bot", targets: ["wake", "tab:bot", "drawer:upgrades"] });
    const toSeller = P([...INTRO, "upgrades", "unlock", "bot"]);
    expect(step(toSeller, run)).toMatchObject({ id: "seller", targets: ["seller", "tab:machines", "drawer:upgrades"] });
    // auto-spin needs the seller first (F2): with the seller's step passed but no seller, nothing is ready
    expect(step(P([...toSeller.done, "seller"]), run)).toBeNull();
    run.buySeller();
    expect(step(P([...toSeller.done, "seller"]), run)).toMatchObject({
      id: "autospin",
      targets: ["autospin", "tab:machines", "drawer:upgrades"],
    });
    run.state.unlocked = [...run.runCases()];
    expect(step(P([...toSeller.done, "seller", "autospin"]), run)).toEqual({
      id: "vault",
      text: "tut.vault",
      targets: ["vault", "drawer:cases"],
      ok: true,
    });
  });

  it("shows a later step while earlier ones still wait for their condition", () => {
    const run = new Run(1);
    run.state.unlocked = [...run.runCases()]; // the vault is out
    run.state.cash = 0; // nothing affordable: upgrades, bot, seller and auto-spin all wait
    const p = P(INTRO);
    expect(step(p, run)).toMatchObject({ id: "vault" });
    run.state.cash = 1e12; // now the upgrades can be bought: the earlier step comes first again
    expect(step(p, run)).toMatchObject({ id: "upgrades" });
  });

  it("passes a step the player did before its bubble came up (Review Focus 2)", () => {
    const run = new Run(1);
    run.state.cash = 1e12;
    run.wakeBot();
    run.buySeller();
    const p = settle(P(INTRO), buildView(run));
    expect(p.done).toEqual([...INTRO, "bot", "seller"]);
    expect(settle(p, buildView(run))).toBe(p); // nothing new: the same object, so the overlay writes nothing
  });

  it("ends the vault's step on OK, or on buying the vault", () => {
    const p = P([...INTRO, "upgrades", "unlock", "bot", "seller", "autospin"]);
    expect(acknowledge(p, "vault").done).toContain("vault");
    expect(afterEvent(p, { type: "vaultBought", price: 1 }).done).toContain("vault");
  });

  it("shows nothing while the vault is out, after the run, or once skipped", () => {
    const run = new Run(1);
    run.state.cash = 1e15;
    run.state.unlocked = [...run.runCases()];
    expect(step(P(), run)).toMatchObject({ id: "buy" });
    expect(step(skip(P()), run)).toBeNull();
    run.buyVault();
    expect(buildView(run).vault.phase).toBe("key");
    expect(whatToShow(P(), buildView(run))).toBeNull();
    const over = new Run(1);
    over.state.over = true;
    expect(whatToShow(P(), buildView(over))).toBeNull();
  });
});

describe("progress", () => {
  it("seeds a returning player's progress from the save: no bench loop, no steps they did, no card for runs reached (Review Focus 1)", () => {
    const run = runOf(2);
    run.state.cash = 1e12;
    run.wakeBot();
    run.buySeller();
    const v = buildView(run);
    const p = seed(v);
    expect(p).toEqual({ done: [...INTRO, "bot", "seller"], off: false, cards: [2] });
    expect(whatToShow(p, v)).toMatchObject({ kind: "step", step: { id: "upgrades" } });
  });

  it("seeds a fresh save with nothing done", () => {
    expect(seed(buildView(new Run(1)))).toEqual(FRESH_TUTORIAL);
  });

  it("shows each new run's card once, before any bubble, even after Skip; Run 1 has none", () => {
    const v2 = buildView(runOf(2));
    expect(whatToShow(P(INTRO), v2)).toEqual({ kind: "card", run: 2 });
    expect(whatToShow(skip(P(INTRO)), v2)).toEqual({ kind: "card", run: 2 });
    expect(whatToShow(closeCard(P(INTRO), 2), v2)?.kind).not.toBe("card");
    expect(whatToShow(P(INTRO), buildView(runOf(3)))).toEqual({ kind: "card", run: 3 });
    expect(whatToShow(P(), buildView(new Run(1)))?.kind).toBe("step");
    expect(NEW_RUN_CARDS).toEqual([2, 3, 4]);
    expect([2, 3, 4].map(cardText)).toEqual(["card.run2", "card.run3", "card.run4"]); // Run 4's waits for F6
  });

  it("replays from the start but keeps the cards seen", () => {
    expect(replay({ done: [...INTRO, "bot"], off: true, cards: [2] })).toEqual({ done: [], off: false, cards: [2] });
    expect(replay(null)).toEqual(FRESH_TUTORIAL);
  });

  it("cleans up whatever prefs held", () => {
    expect(parseTutorial(undefined)).toBeNull();
    expect(parseTutorial("x")).toBeNull();
    expect(parseTutorial({ done: ["sell", "nope", "buy"], off: "yes", cards: [3, "x", 2, 2, -1, 1.5] })).toEqual({
      done: ["buy", "sell"],
      off: false,
      cards: [2, 3],
    });
    expect(parseTutorial({})).toEqual(FRESH_TUTORIAL);
  });
});
