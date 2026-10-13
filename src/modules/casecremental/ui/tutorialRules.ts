import type { GameView, UpgradeView } from "../game/view";
import type { StringKey } from "../i18n/en";
import type { SimEvent } from "../sim/run";

// The tutorial's coach (finish spec §4) as pure rules: nine steps, each a speech bubble pointing at the thing to
// touch. A step ends when the player does it (an event, or the state shows it done), never on a timer. The bench loop
// (buy, key, sell) runs in order; the later steps each wait until they can be done (affordable, the vault out) and the
// first ready one shows. A new run's "what's new" card comes before any bubble. Progress lives in prefs (per browser),
// not in the run save. The overlay (Tutorial.tsx) asks what to show and reports what happened.

export const STEP_IDS = ["buy", "key", "sell", "upgrades", "unlock", "bot", "seller", "autospin", "vault"] as const;
export type StepId = (typeof STEP_IDS)[number];

/** The bench loop: in order, and nothing later shows before it is done. */
const INTRO: readonly StepId[] = ["buy", "key", "sell"];

/** Runs whose first start shows a "what's new" card. */
export const NEW_RUN_CARDS: readonly number[] = [2, 3, 4];

const CARD_TEXT: Record<number, StringKey> = { 2: "card.run2", 3: "card.run3", 4: "card.run4" };

/** A new run's card text. */
export const cardText = (run: number): StringKey => CARD_TEXT[run] ?? "card.run2";

export interface TutorialProgress {
  /** Steps finished, in STEP_IDS order. */
  done: StepId[];
  /** "Skip tutorial" was pressed: no more bubbles (the new-run cards still show). */
  off: boolean;
  /** Runs whose new-run card was closed. */
  cards: number[];
}

export const FRESH_TUTORIAL: TutorialProgress = { done: [], off: false, cards: [] };

/** Where a bubble can point. DOM targets are elements marked `data-tut="<id>"`; world targets are props on the table. */
export type TargetId =
  | `case:${string}`
  | `upgrade:${string}`
  | "vault"
  | "wake"
  | "seller"
  | "autospin"
  | "tab:you"
  | "tab:bot"
  | "tab:machines"
  | "drawer:cases"
  | "drawer:upgrades"
  | "world:bench"
  | "world:card"
  | "world:bin";

export interface ShownStep {
  id: StepId;
  text: StringKey;
  /** Deepest first: the overlay points at the first one on screen (a row in a closed tab is not, so then its tab). */
  targets: TargetId[];
  /** The bubble has an OK button (the vault's step: buying the vault can be far off). */
  ok: boolean;
}

export type Showing = { kind: "card"; run: number } | { kind: "step"; step: ShownStep };

interface StepDef {
  text: StringKey;
  /** It can be done now: show it. */
  ready(v: GameView): boolean;
  /** The state shows it done (a returning player, or one ahead of the coach). */
  doneBy?(v: GameView): boolean;
  /** This event is the player doing it. */
  doneOn?(e: SimEvent): boolean;
  targets(v: GameView): TargetId[];
}

const cheapestAffordable = (v: GameView): UpgradeView | null =>
  v.upgrades.reduce<UpgradeView | null>((best, u) => (u.canBuy && (best === null || (u.cost ?? 0) < (best.cost ?? 0)) ? u : best), null);
const nextLocked = (v: GameView) => v.cases.find((c) => !c.unlocked) ?? null;
const UPGRADES_TAB: TargetId[] = ["tab:you", "drawer:upgrades"];
const MACHINES_TAB: TargetId[] = ["tab:machines", "drawer:upgrades"];

const STEPS: Record<StepId, StepDef> = {
  buy: {
    text: "tut.buy",
    ready: (v) => v.phase === "empty" && v.cases.some((c) => c.canBuy),
    doneBy: (v) => v.phase !== "empty",
    targets: (v) => [`case:${(v.cases.find((c) => c.canBuy) ?? v.cases[0]!).id}`, "drawer:cases"],
  },
  key: {
    text: "tut.key",
    ready: (v) => v.phase === "locked",
    doneBy: (v) => v.phase === "spinning" || v.phase === "revealed",
    targets: () => ["world:bench"],
  },
  sell: {
    text: "tut.sell",
    ready: (v) => v.phase === "revealed",
    // sold by hand or by the auto-seller, or stored (the tray, the locker): the card left the bench
    doneOn: (e) => (e.type === "sold" || e.type === "stored" || e.type === "lockerStored") && e.from === "bench",
    targets: (v) => [v.held === "bench" ? "world:bin" : "world:card"],
  },
  upgrades: {
    text: "tut.upgrades",
    ready: (v) => cheapestAffordable(v) !== null,
    doneBy: (v) => v.upgrades.some((u) => u.level > 0),
    targets: (v) => {
      const u = cheapestAffordable(v);
      return u ? [`upgrade:${u.id}`, ...UPGRADES_TAB] : UPGRADES_TAB;
    },
  },
  unlock: {
    text: "tut.unlock",
    ready: (v) => nextLocked(v)?.canUnlock === true,
    doneBy: (v) => v.cases.filter((c) => c.unlocked).length > 1,
    targets: (v) => [`case:${(nextLocked(v) ?? v.cases[0]!).id}`, "drawer:cases"],
  },
  bot: { text: "tut.bot", ready: (v) => v.bot.canWake, doneBy: (v) => v.bot.awake, targets: () => ["wake", "tab:bot", "drawer:upgrades"] },
  seller: { text: "tut.seller", ready: (v) => v.seller.canBuy, doneBy: (v) => v.seller.on, targets: () => ["seller", ...MACHINES_TAB] },
  autospin: {
    text: "tut.autospin",
    ready: (v) => v.autoSpin.canBuy,
    doneBy: (v) => v.autoSpin.owned,
    targets: () => ["autospin", ...MACHINES_TAB],
  },
  vault: {
    text: "tut.vault",
    ready: (v) => v.vault.shown,
    doneOn: (e) => e.type === "vaultBought",
    targets: () => ["vault", "drawer:cases"],
  },
};

/** `p` with these steps done (in STEP_IDS order); `p` itself when none is new, so a caller can skip the write. */
function withDone(p: TutorialProgress, ids: readonly StepId[]): TutorialProgress {
  const fresh = ids.filter((id) => !p.done.includes(id));
  if (!fresh.length) return p;
  const done = new Set([...p.done, ...fresh]);
  return { ...p, done: STEP_IDS.filter((id) => done.has(id)) };
}

/** Whatever prefs held → valid progress, or null (never stored: the overlay seeds it from the save). */
export function parseTutorial(raw: unknown): TutorialProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
  const done = list(o.done);
  const cards = list(o.cards).filter((n): n is number => Number.isInteger(n) && (n as number) > 0);
  return { done: STEP_IDS.filter((id) => done.includes(id)), off: o.off === true, cards: [...new Set(cards)].sort((a, b) => a - b) };
}

/** Steps the state already shows done join `done`. */
export const settle = (p: TutorialProgress, v: GameView): TutorialProgress =>
  withDone(
    p,
    STEP_IDS.filter((id) => STEPS[id].doneBy?.(v) === true),
  );

/** The player did something: the steps it completes join `done`. */
export const afterEvent = (p: TutorialProgress, e: SimEvent): TutorialProgress =>
  withDone(
    p,
    STEP_IDS.filter((id) => STEPS[id].doneOn?.(e) === true),
  );

/** The step's OK button. */
export const acknowledge = (p: TutorialProgress, id: StepId): TutorialProgress => withDone(p, [id]);

/** "Skip tutorial". */
export const skip = (p: TutorialProgress): TutorialProgress => (p.off ? p : { ...p, off: true });

/** Settings' "Replay tutorial": the coach from the start; the new-run cards seen stay seen. */
export const replay = (p: TutorialProgress | null): TutorialProgress => ({ done: [], off: false, cards: [...(p?.cards ?? [])] });

/** The new-run card was tapped away. */
export const closeCard = (p: TutorialProgress, run: number): TutorialProgress =>
  p.cards.includes(run) ? p : { ...p, cards: [...p.cards, run].sort((a, b) => a - b) };

/** A save that has played past the bench loop. */
const experienced = (v: GameView): boolean =>
  v.run > 1 || v.upgrades.some((u) => u.level > 0) || v.cases.filter((c) => c.unlocked).length > 1 || v.bot.awake || v.seller.on;

/** F3's first load in this browser: a save that has played on skips the bench loop and every step it shows done, and
 *  the runs it has reached have no card. A fresh save starts from nothing. From Run 2 on every step is done: each run
 *  resets unlocks, upgrades, the seller and auto-spin, but the player finished a run, so they did all nine. */
export function seed(v: GameView): TutorialProgress {
  const p = v.run > 1 ? withDone(FRESH_TUTORIAL, STEP_IDS) : withDone(settle(FRESH_TUTORIAL, v), experienced(v) ? INTRO : []);
  return { ...p, cards: NEW_RUN_CARDS.filter((n) => n <= v.run) };
}

/** The bubble to show now, or null: the first bench-loop step not done (if it can be done now), else the first later
 *  step that is ready. Nothing while the vault is out, after the run, or once skipped. */
export function currentStep(p: TutorialProgress, v: GameView): ShownStep | null {
  if (p.off || v.vault.phase !== null || v.over) return null;
  for (const id of STEP_IDS) {
    if (p.done.includes(id)) continue;
    const s = STEPS[id];
    if (s.ready(v)) return { id, text: s.text, targets: s.targets(v), ok: id === "vault" };
    if (INTRO.includes(id)) return null; // the bench loop goes in order
  }
  return null;
}

/** What the overlay shows: a new run's card first (once per run, even after Skip), else the current bubble. */
export function whatToShow(p: TutorialProgress, v: GameView): Showing | null {
  if (v.vault.phase !== null || v.over) return null;
  if (NEW_RUN_CARDS.includes(v.run) && !p.cards.includes(v.run)) return { kind: "card", run: v.run };
  const step = currentStep(p, v);
  return step ? { kind: "step", step } : null;
}
