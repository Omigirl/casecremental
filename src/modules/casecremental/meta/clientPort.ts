import type { IDosGamesClient } from "@idosgames/core";
import type { PortReply, ServerPort } from "./bridge";

// The SDK side of the server port (plan F7): CloudCode handlers through client.cloudCode.execute and the best_run
// score through client.leaderboard.submitScore. SDK calls answer OperationResult and do not throw; a call that
// hangs is cut off after `timeoutMs` and counts as offline.

export const LEADERBOARD_ID = "best_run";
/** CloudCode errors worth another try. HandlerNotFound / NoActiveRevision: a fresh publish takes a few minutes to
 *  reach every server (seen on ZVKC34TR-DEV), so they are not a refusal for good. */
const RETRY_ERRORS = new Set([
  "RateLimited",
  "Timeout",
  "ApiCallLimitExceeded",
  "StatementCountExceeded",
  "HandlerNotFound",
  "NoActiveRevision",
]);

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      () => (clearTimeout(timer), resolve(fallback)),
    );
  });
}

function readResult(raw: unknown): Record<string, unknown> | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function clientPort(client: IDosGamesClient, timeoutMs = 10_000): ServerPort {
  const offline: PortReply = { kind: "offline", reason: "timeout" };
  return {
    async call(name, args) {
      const r = await withTimeout(client.cloudCode.execute(name, args as never), timeoutMs, null);
      if (r === null) return offline;
      if (!r.ok) return r.reason === "server" ? { kind: "refused", reason: r.error, retry: true } : { kind: "offline", reason: r.error };
      const err = r.data.Error?.Error;
      if (err && err !== "None")
        return RETRY_ERRORS.has(err) ? { kind: "offline", reason: err } : { kind: "refused", reason: err, retry: false };
      const data = readResult(r.data.FunctionResult);
      if (!data) return { kind: "refused", reason: "no result", retry: false };
      if (data.ok === false) return { kind: "refused", reason: String(data.reason ?? "refused"), retry: data.retry === true };
      return { kind: "ok", data };
    },
    async submitScore(score) {
      const r = await withTimeout(client.leaderboard.submitScore(LEADERBOARD_ID, score), timeoutMs, null);
      if (r === null) return offline;
      return r.ok
        ? { kind: "ok", data: {} }
        : r.reason === "server"
          ? { kind: "refused", reason: r.error, retry: false }
          : { kind: "offline", reason: r.error };
    },
  };
}
