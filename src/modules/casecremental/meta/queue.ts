// The server call queue (plan F7). Every meta call to the Title goes through it, so a call made offline is kept — in
// localStorage, across reloads — and retried with back-off. Strictly first in, first out: an endRun pays the CLOUT
// a later buyPerk spends. A saveMeta replaces any saveMeta still waiting (only the newest stats matter). A broken
// stored queue is dropped, never thrown.

export type CallName = "reportTrophy" | "endRun" | "buyPerk" | "saveMeta" | "submitScore";

export interface QueuedCall {
  id: string;
  name: CallName;
  args: Record<string, unknown>;
  tries: number;
  /** Unix seconds before which it is not sent again. */
  nextAt: number;
}

export const QUEUE_KEY = "casecremental.serverQueue";
/** Seconds to wait after each failed try (the last value repeats). */
export const BACKOFF_SECONDS = [2, 5, 15, 60, 300] as const;
export const MAX_TRIES = 12;
export const MAX_QUEUE = 200;

type Store = Pick<Storage, "getItem" | "setItem">;

function load(store: Store | null): QueuedCall[] {
  try {
    const raw = store?.getItem(QUEUE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((c): c is QueuedCall => typeof c?.id === "string" && typeof c?.name === "string" && typeof c?.args === "object")
      : [];
  } catch {
    return [];
  }
}

export class CallQueue {
  private items: QueuedCall[];

  constructor(private readonly store: Store | null) {
    this.items = load(store);
  }

  get size(): number {
    return this.items.length;
  }

  push(call: { id: string; name: CallName; args: Record<string, unknown> }, now: number): void {
    if (this.items.some((c) => c.id === call.id)) return;
    if (call.name === "saveMeta") this.items = this.items.filter((c) => c.name !== "saveMeta");
    this.items.push({ ...call, tries: 0, nextAt: now });
    if (this.items.length > MAX_QUEUE) this.items.splice(0, this.items.length - MAX_QUEUE);
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

  /** Backs the call off; true when it was dropped after MAX_TRIES. */
  retryLater(id: string, now: number): boolean {
    const c = this.items.find((x) => x.id === id);
    if (!c) return false;
    c.tries += 1;
    if (c.tries >= MAX_TRIES) {
      console.warn(`[casecremental] gave up on the server call ${c.name} after ${c.tries} tries`);
      this.done(id);
      return true;
    }
    c.nextAt = now + BACKOFF_SECONDS[Math.min(c.tries - 1, BACKOFF_SECONDS.length - 1)]!;
    this.persist();
    return false;
  }

  /** An endRun or buyPerk still waiting: the server's CLOUT and perks are older than the local ones. */
  hasWrites(): boolean {
    return this.items.some((c) => c.name === "endRun" || c.name === "buyPerk");
  }

  private persist(): void {
    try {
      this.store?.setItem(QUEUE_KEY, JSON.stringify(this.items));
    } catch {
      // storage full or blocked: the queue still works for this session
    }
  }
}
