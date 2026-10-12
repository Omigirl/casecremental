import type { IDosGamesClient } from "@idosgames/core";
import type { PortReply, ServerPort } from "./bridge";
import type { JsonObject } from "./queue";
import { verifiedSolanaWallet } from "./wallet";

// The SDK side of the server port (plan F7): CloudCode handlers through client.cloudCode.execute and the best_run
// score through client.leaderboard.submitScore. SDK calls answer OperationResult and do not throw; a call that
// hangs is cut off after `timeoutMs` and counts as offline.
// Only a handler's own answer { ok: false, retry: false } refuses a call for good. Everything else that goes wrong is
// "offline" (no answer: the connection, the session, a publish still spreading — never counted against the call) or
// a refusal worth another try (counted, backed off).

export const LEADERBOARD_ID = "best_run";
/** CloudCode errors that mean "not now" rather than an answer. HandlerNotFound / NoActiveRevision: a fresh publish
 *  takes a few minutes to reach every server (seen on ZVKC34TR-DEV). */
const NOT_NOW_ERRORS = new Set(["RateLimited", "Timeout", "HandlerNotFound", "NoActiveRevision"]);
/** SDK failure reasons where no answer came from the game's server. */
const NO_ANSWER = new Set(["connection", "unauthorized", "throttled"]);

/** CloudCode's FunctionParameter type (JsonValue, which @idosgames/core does not export by name). */
type FunctionParameter = Parameters<IDosGamesClient["cloudCode"]["execute"]>[1];

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

/**
 * The Solana wallet the platform verified for the signed-in account (plan F8), read at send time: an address, null for
 * none, or undefined when the read failed (then endRun leaves the leaderboard's wallet key as it is).
 */
async function signedInWallet(client: IDosGamesClient, timeoutMs: number): Promise<string | null | undefined> {
  try {
    const r = await withTimeout(client.blockchain.getUserState(), timeoutMs, null);
    return r && r.ok ? verifiedSolanaWallet(r.data.State) : undefined;
  } catch {
    return undefined;
  }
}

/** The port for `owner`'s calls: while another account is signed in (or no one), every call waits as "offline". */
export function clientPort(client: IDosGamesClient, owner: string | null = null, timeoutMs = 10_000): ServerPort {
  const offline: PortReply = { kind: "offline", reason: "timeout" };
  const otherAccount = (): boolean => owner !== null && client.auth.context?.userID !== owner;
  const notSignedIn: PortReply = { kind: "offline", reason: "another account is signed in" };
  return {
    async call(name, args: JsonObject) {
      if (otherAccount()) return notSignedIn;
      // endRun publishes the player's wallet for the leaderboard; CloudCode cannot read it itself (meta/wallet.ts)
      const wallet = name === "endRun" ? await signedInWallet(client, timeoutMs) : undefined;
      const parameter: FunctionParameter = wallet === undefined ? args : { ...args, wallet };
      const r = await withTimeout(client.cloudCode.execute(name, parameter), timeoutMs, null);
      if (r === null) return offline;
      if (!r.ok) return NO_ANSWER.has(r.reason) ? { kind: "offline", reason: r.error } : { kind: "refused", reason: r.error, retry: true };
      const err = r.data.Error?.Error;
      if (err && err !== "None")
        return NOT_NOW_ERRORS.has(err) ? { kind: "offline", reason: err } : { kind: "refused", reason: err, retry: true };
      const data = readResult(r.data.FunctionResult);
      if (!data) return { kind: "refused", reason: "no result", retry: true };
      if (data.ok === false) return { kind: "refused", reason: String(data.reason ?? "refused"), retry: data.retry === true };
      return { kind: "ok", data };
    },
    async submitScore(score) {
      if (otherAccount()) return notSignedIn;
      const r = await withTimeout(client.leaderboard.submitScore(LEADERBOARD_ID, score), timeoutMs, null);
      if (r === null) return offline;
      if (r.ok) return { kind: "ok", data: {} };
      return NO_ANSWER.has(r.reason) ? { kind: "offline", reason: r.error } : { kind: "refused", reason: r.error, retry: true };
    },
  };
}
