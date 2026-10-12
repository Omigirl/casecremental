import { CallQueue, type CallName, type JsonObject } from "./queue";

// The server side of the meta (plan F7): reads the player's meta from the Title and sends the queued calls, one at a
// time, in order. Never throws and never blocks the game: a call that cannot go now stays in the queue. The port is
// the only thing that talks to the SDK (meta/clientPort.ts), so the tests drive this with a fake.
// A call with no answer ("offline") waits without counting against it; a write the server refuses for good is followed
// by a loadMeta, so the local meta learns what the server kept. A loadMeta answer that crossed a write's answer (sent
// before it, arriving after) is ignored: it may describe the server before that write.

export type PortReply =
  | { kind: "ok"; data: Record<string, unknown> }
  | { kind: "refused"; reason: string; retry: boolean }
  | { kind: "offline"; reason: string };

export interface ServerPort {
  call(name: string, args: JsonObject): Promise<PortReply>;
  submitScore(score: number): Promise<PortReply>;
}

/** What every CloudCode handler answers (its "view" of the player's server meta). */
export interface ServerDoc {
  clout: number;
  trophies: string[];
  perks: Record<string, number>;
  loops: number;
  stats: { playSeconds: number; opened: number; best: { skinId: string; value: number } | null; cloutEarned: number };
  picked: string[];
}

export type ServerStatus = "unknown" | "online" | "offline";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** A handler's view, or null when it is not one. */
export function parseDoc(d: Record<string, unknown>): ServerDoc | null {
  if (d.ok !== true || !isNum(d.clout) || !Array.isArray(d.trophies) || !isObj(d.perks) || !isNum(d.loops) || !isObj(d.stats)) return null;
  const s = d.stats;
  const best =
    isObj(s.best) && typeof s.best.skinId === "string" && isNum(s.best.value) ? { skinId: s.best.skinId, value: s.best.value } : null;
  return {
    clout: d.clout,
    trophies: d.trophies.filter((t): t is string => typeof t === "string"),
    perks: Object.fromEntries(Object.entries(d.perks).filter(([, v]) => isNum(v))) as Record<string, number>,
    loops: d.loops,
    stats: {
      playSeconds: isNum(s.playSeconds) ? s.playSeconds : 0,
      opened: isNum(s.opened) ? s.opened : 0,
      best,
      cloutEarned: isNum(s.cloutEarned) ? s.cloutEarned : 0,
    },
    picked: Array.isArray(d.picked) ? d.picked.filter((c): c is string => typeof c === "string") : [],
  };
}

export class ServerMeta {
  private state: ServerStatus = "unknown";
  private owned = new Set<string>();
  private running: Promise<void> | null = null;
  /** Write answers taken so far: a loadMeta that saw this change while in flight is stale. */
  private writesTaken = 0;
  private readonly docListeners = new Set<(doc: ServerDoc) => void>();
  private readonly statusListeners = new Set<(s: ServerStatus) => void>();

  constructor(
    private readonly port: ServerPort,
    private readonly queue: CallQueue,
    private readonly clock: () => number = () => Date.now() / 1000,
  ) {}

  get status(): ServerStatus {
    return this.state;
  }

  /** The trophies the server answered last (the Title's inventory as CloudCode reads it). */
  get trophies(): ReadonlySet<string> {
    return this.owned;
  }

  onDoc(l: (doc: ServerDoc) => void): () => void {
    this.docListeners.add(l);
    return () => this.docListeners.delete(l);
  }

  onStatus(l: (s: ServerStatus) => void): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  hasPendingWrites(): boolean {
    return this.queue.hasWrites();
  }

  /** The server's meta, merged; null offline or when a write's answer overtook it. */
  async load(): Promise<ServerDoc | null> {
    const seen = this.writesTaken;
    const r = await this.safe(() => this.port.call("loadMeta", {}));
    if (r.kind !== "ok") {
      if (r.kind === "offline") this.setStatus("offline");
      return null;
    }
    this.setStatus("online");
    return this.writesTaken === seen ? this.take(r.data) : null;
  }

  enqueue(name: CallName, args: JsonObject, id: string): void {
    this.queue.push({ id, name, args }, this.clock());
    void this.pump();
  }

  /** The connection is back: send the waiting calls now instead of at their back-off time. */
  retryNow(): Promise<void> {
    this.queue.wake(this.clock());
    return this.pump();
  }

  /** Sends the due calls in order. A second pump while one runs joins it (and the running one picks up new calls). */
  pump(): Promise<void> {
    if (!this.running) this.running = this.drain().finally(() => (this.running = null));
    return this.running;
  }

  private async drain(): Promise<void> {
    for (let call = this.queue.head(this.clock()); call; call = this.queue.head(this.clock())) {
      const c = call;
      const r = await this.safe(() =>
        c.name === "submitScore" ? this.port.submitScore(Number(c.args.score)) : this.port.call(c.name, this.sendArgs(c.name, c.args)),
      );
      if (r.kind === "offline" || (r.kind === "refused" && r.retry)) {
        if (r.kind === "offline") this.setStatus("offline");
        this.queue.retryLater(c.id, this.clock(), r.kind === "offline");
        return;
      }
      this.setStatus("online");
      this.queue.done(c.id);
      if (r.kind === "refused") {
        console.warn(`[casecremental] the server refused ${c.name}: ${r.reason}`);
        if (c.name === "endRun" || c.name === "buyPerk") await this.load(); // what the server kept instead
        continue;
      }
      if (this.take(r.data)) this.writesTaken++;
      const score = r.data.score;
      if (c.name === "endRun" && r.data.serverScore !== true && isNum(score) && score > 0)
        this.queue.push({ id: `score-${String(c.args.runId ?? c.id)}`, name: "submitScore", args: { score } }, this.clock());
    }
  }

  /** endRun says when the run ended as "seconds ago" at send time: the server's clock and the player's never mix. */
  private sendArgs(name: CallName, args: JsonObject): JsonObject {
    const endedAt = args.endedAt;
    if (name !== "endRun" || typeof endedAt !== "number") return args;
    return { ...args, endedAgoSec: Math.max(0, Math.floor(this.clock() - endedAt)) };
  }

  private take(data: Record<string, unknown>): ServerDoc | null {
    const doc = parseDoc(data);
    if (!doc) return null;
    this.owned = new Set(doc.trophies);
    for (const l of this.docListeners) l(doc);
    return doc;
  }

  private async safe(fn: () => Promise<PortReply>): Promise<PortReply> {
    try {
      return await fn();
    } catch (err) {
      return { kind: "offline", reason: String(err) };
    }
  }

  private setStatus(s: ServerStatus): void {
    if (s === this.state) return;
    this.state = s;
    for (const l of this.statusListeners) l(s);
  }
}
