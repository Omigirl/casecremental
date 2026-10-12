// The server call queue (plan F7). Every meta call to the Title goes through it, so a call made offline is kept — in
// localStorage, across reloads, under the signed-in account's own key — and retried with back-off. Strictly first in,
// first out: an endRun pays the CLOUT a later buyPerk spends. A saveMeta replaces any saveMeta still waiting (only the
// newest stats matter). A broken stored queue is dropped, never thrown.
// Time offline never counts against a call. An endRun or buyPerk is never given up on (only the handler's own
// "refused for good" drops it); the other calls are dropped after MAX_TRIES answered failures.

export type CallName = "reportTrophy" | "endRun" | "buyPerk" | "saveMeta" | "submitScore";

/** What a call's arguments may hold: they travel as JSON (CloudCode's FunctionParameter) and sit in localStorage. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface QueuedCall {
  id: string;
  name: CallName;
  args: JsonObject;
  /** Failed sends so far, offline ones included: the back-off. */
  tries: number;
  /** Failures the server answered (not offline): what MAX_TRIES counts. */
  strikes: number;
  /** Unix seconds before which it is not sent again. */
  nextAt: number;
}

/** The legacy (pre-account) key; each account's queue lives under `${QUEUE_KEY}.${userID}` (see meta/account.ts). */
export const QUEUE_KEY = "casecremental.serverQueue";
/** Seconds to wait after each failed try (the last value repeats). */
export const BACKOFF_SECONDS = [2, 5, 15, 60, 300] as const;
/** Offline, a call is tried again at least this often (the network may be back before the browser says so). */
export const OFFLINE_MAX_WAIT = 60;
export const MAX_TRIES = 12;
export const MAX_QUEUE = 200;

type Store = Pick<Storage, "getItem" | "setItem">;

/** Calls whose loss would leave the server's CLOUT or perks behind for good. */
const isWrite = (name: CallName): boolean => name === "endRun" || name === "buyPerk";

function load(store: Store | null, key: string): QueuedCall[] {
  try {
    const raw = store?.getItem(key);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list
          .filter(
            (c): c is QueuedCall =>
              typeof c?.id === "string" && typeof c?.name === "string" && typeof c?.args === "object" && c.args !== null,
          )
          .map((c) => ({ ...c, tries: Number(c.tries) || 0, strikes: Number(c.strikes) || 0, nextAt: Number(c.nextAt) || 0 }))
      : [];
  } catch {
    return [];
  }
}

export class CallQueue {
  private items: QueuedCall[];

  /** `key`: the account's storage key (meta/account.ts accountKey); the legacy key when no one is signed in. */
  constructor(
    private readonly store: Store | null,
    private readonly key: string = QUEUE_KEY,
  ) {
    this.items = load(store, key);
  }

  get size(): number {
    return this.items.length;
  }

  push(call: { id: string; name: CallName; args: JsonObject }, now: number): void {
    if (this.items.some((c) => c.id === call.id)) return;
    if (call.name === "saveMeta") this.items = this.items.filter((c) => c.name !== "saveMeta");
    this.items.push({ ...call, tries: 0, strikes: 0, nextAt: now });
    // full: drop the oldest call that may be lost — never an endRun or buyPerk
    while (this.items.length > MAX_QUEUE) {
      const i = this.items.findIndex((c) => !isWrite(c.name));
      if (i < 0) break;
      this.items.splice(i, 1);
    }
    this.persist();
  }

  /** The first call, when it is due (a later call never jumps it). */
  head(now: number): QueuedCall | null {
    const first = this.items[0];
    return first && first.nextAt <= now ? first : null;
  }

  done(id: string): void {
    this.items = this.items.filter((c) => c.id !== id);
    this.persist();
  }

  /** Backs the call off; true when it was dropped. `offline`: no answer came, which never counts toward MAX_TRIES. */
  retryLater(id: string, now: number, offline: boolean): boolean {
    const c = this.items.find((x) => x.id === id);
    if (!c) return false;
    c.tries += 1;
    if (!offline) c.strikes += 1;
    if (!offline && !isWrite(c.name) && c.strikes >= MAX_TRIES) {
      console.warn(`[casecremental] gave up on the server call ${c.name} after ${c.strikes} failed answers`);
      this.done(id);
      return true;
    }
    const wait = BACKOFF_SECONDS[Math.min(c.tries - 1, BACKOFF_SECONDS.length - 1)]!;
    c.nextAt = now + (offline ? Math.min(wait, OFFLINE_MAX_WAIT) : wait);
    this.persist();
    return false;
  }

  /** The first call is due now (the browser came back online). */
  wake(now: number): void {
    const first = this.items[0];
    if (first && first.nextAt > now) {
      first.nextAt = now;
      this.persist();
    }
  }

  /** An endRun or buyPerk still waiting: the server's CLOUT and perks are older than the local ones. */
  hasWrites(): boolean {
    return this.items.some((c) => isWrite(c.name));
  }

  private persist(): void {
    try {
      this.store?.setItem(this.key, JSON.stringify(this.items));
    } catch {
      // storage full or blocked: the queue still works for this session
    }
  }
}
