import { freshMeta, type MetaState } from "../sim/meta";
import { DEFAULT_SETUP, type RunSnapshot } from "../sim/run";

// The local save (M2b spec §9): the meta and the run in progress under one localStorage key, versioned.
// Version 2 (rework): the bot opens, the auto-seller sells; a version-1 save starts fresh.
// A save that is missing, broken or from another version never stops the game — it is dropped with a
// warning and a fresh run starts; storage errors are swallowed. M4 moves the same data to the server.

export const SAVE_KEY = "casecremental.save";
export const SAVE_VERSION = 2;

export interface SaveData {
  v: typeof SAVE_VERSION;
  meta: MetaState;
  run: RunSnapshot;
}

export type SaveStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

const BENCH_PHASES = ["empty", "locked", "spinning", "revealed"];

/** A bench the run and the World can both work with. */
function isBench(b: unknown): boolean {
  if (!isObj(b) || typeof b.phase !== "string" || !BENCH_PHASES.includes(b.phase)) return false;
  if (b.phase === "empty") return true;
  if (typeof b.caseId !== "string") return false;
  if (b.phase === "spinning") return isObj(b.drop) && isNum(b.elapsed) && isNum(b.fullDuration);
  return b.phase === "revealed" ? isObj(b.drop) : true;
}

/** Fills in what an older or partial save leaves out (a perk or setup field added later). */
function normalize(d: SaveData): SaveData {
  const fresh = freshMeta();
  const meta: MetaState = { ...fresh, ...d.meta, perks: { ...fresh.perks, ...d.meta.perks } };
  const setup = { ...DEFAULT_SETUP, ...d.run.setup };
  if (!Array.isArray(setup.charms)) setup.charms = [];
  // nobody is holding a card after a reload
  return { ...d, meta, run: { ...d.run, setup, state: { ...d.run.state, held: null, vault: d.run.state.vault ?? null } } };
}

function isSave(d: unknown): d is SaveData {
  if (!isObj(d) || d.v !== SAVE_VERSION || !isObj(d.meta) || !isObj(d.run)) return false;
  const m = d.meta;
  const r = d.run;
  if (!isNum(m.clout) || !isObj(m.perks) || !Array.isArray(m.trophies) || !isNum(m.loops) || !Array.isArray(m.picked)) return false;
  if (!isNum(r.seed) || !isNum(r.rng) || !isObj(r.setup) || !isObj(r.state)) return false;
  const s = r.state;
  return (
    isNum(s.cash) &&
    isNum(s.time) &&
    isBench(s.bench) &&
    Array.isArray(s.tray) &&
    isObj(s.bot) &&
    isObj(s.seller) &&
    Array.isArray(s.unlocked)
  );
}

export const encodeSave = (data: SaveData): string => JSON.stringify(data);

export function decodeSave(raw: string | null): SaveData | null {
  if (raw === null) return null;
  try {
    const d: unknown = JSON.parse(raw);
    if (isSave(d)) return normalize(d);
  } catch {
    // fall through to the warning
  }
  console.warn("[casecremental] the saved game could not be read — starting fresh");
  return null;
}

export class SaveSlot {
  constructor(private readonly store: SaveStore | null) {}

  load(): SaveData | null {
    let raw: string | null = null;
    try {
      raw = this.store?.getItem(SAVE_KEY) ?? null;
    } catch {
      return null;
    }
    return decodeSave(raw);
  }

  save(data: SaveData): void {
    try {
      this.store?.setItem(SAVE_KEY, encodeSave(data));
    } catch {
      // storage full or blocked: keep playing
    }
  }

  clear(): void {
    try {
      this.store?.removeItem(SAVE_KEY);
    } catch {
      // nothing to clear
    }
  }
}

/** The browser's localStorage, or no storage at all when it is blocked. */
export function browserSlot(): SaveSlot {
  try {
    return new SaveSlot(typeof localStorage === "undefined" ? null : localStorage);
  } catch {
    return new SaveSlot(null);
  }
}
