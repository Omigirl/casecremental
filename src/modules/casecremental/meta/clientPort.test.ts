import type { IDosGamesClient } from "@idosgames/core";
import { describe, expect, it } from "vitest";
import { clientPort } from "./clientPort";

type Exec =
  | { ok: true; data: { Error?: { Error: string } | null; FunctionResult?: unknown } }
  | { ok: false; reason: string; error: string };

type ChainState = { ok: true; data: { State?: unknown } } | { ok: false; reason: string; error: string };

function fakeClient(user: string | null, exec: Exec, chain: ChainState = { ok: true, data: { State: {} } }) {
  const calls: string[] = [];
  const sent: unknown[] = [];
  const client = {
    auth: { context: user === null ? null : { userID: user } },
    cloudCode: { execute: async (name: string, args: unknown) => (calls.push(name), sent.push(args), exec) },
    leaderboard: { submitScore: async () => (calls.push("score"), exec) },
    blockchain: { getUserState: async () => chain },
  };
  return { client: client as unknown as IDosGamesClient, calls, sent };
}
const ok = (FunctionResult: unknown): Exec => ({ ok: true, data: { Error: null, FunctionResult } });

describe("clientPort", () => {
  it("passes a handler's view, and its own refusal with its retry flag", async () => {
    expect(await clientPort(fakeClient("A", ok({ ok: true, clout: 1 })).client, "A").call("loadMeta", {})).toMatchObject({ kind: "ok" });
    expect(await clientPort(fakeClient("A", ok({ ok: false, reason: "bad", retry: false })).client, "A").call("endRun", {})).toEqual({
      kind: "refused",
      reason: "bad",
      retry: false,
    });
    expect(await clientPort(fakeClient("A", ok('{"ok":false,"reason":"wait","retry":true}')).client, "A").call("endRun", {})).toMatchObject(
      {
        retry: true,
      },
    );
  });

  it("treats no answer as offline and an unknown platform error as worth another try, never as a refusal for good", async () => {
    const port = (e: Exec) => clientPort(fakeClient("A", e).client, "A");
    expect(await port({ ok: false, reason: "connection", error: "down" }).call("endRun", {})).toMatchObject({ kind: "offline" });
    expect(await port({ ok: false, reason: "unauthorized", error: "401" }).call("endRun", {})).toMatchObject({ kind: "offline" });
    expect(await port({ ok: false, reason: "server", error: "500" }).call("endRun", {})).toMatchObject({ kind: "refused", retry: true });
    expect(await port({ ok: true, data: { Error: { Error: "HandlerNotFound" } } }).call("endRun", {})).toMatchObject({ kind: "offline" });
    expect(await port({ ok: true, data: { Error: { Error: "SomethingNew" } } }).call("endRun", {})).toMatchObject({
      kind: "refused",
      retry: true,
    });
    expect(await port(ok("not json")).call("endRun", {})).toMatchObject({ kind: "refused", retry: true });
    expect(await port({ ok: false, reason: "server", error: "x" }).submitScore(5)).toMatchObject({ kind: "refused", retry: true });
  });

  it("tells endRun the Solana wallet the platform verified, null for none, nothing when it could not tell", async () => {
    const W = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
    const sentWith = async (chain: ChainState, name = "endRun") => {
      const f = fakeClient("A", ok({ ok: true }), chain);
      await clientPort(f.client, "A").call(name as "endRun", { runId: "r1" });
      return f.sent[0];
    };
    const signedIn: ChainState = { ok: true, data: { State: { LastWalletLogin: { NetworkID: "solana", Address: W } } } };
    expect(await sentWith(signedIn)).toEqual({ runId: "r1", wallet: W });
    expect(await sentWith({ ok: true, data: { State: { LinkedWallets: {} } } })).toEqual({ runId: "r1", wallet: null });
    expect(await sentWith({ ok: false, reason: "server", error: "no blockchain" })).toEqual({ runId: "r1" });
    expect(await sentWith(signedIn, "saveMeta")).toEqual({ runId: "r1" }); // only endRun publishes it
  });

  it("sends nothing for its account while another one (or no one) is signed in", async () => {
    for (const user of ["B", null]) {
      const { client, calls } = fakeClient(user, ok({ ok: true }));
      const port = clientPort(client, "A");
      expect(await port.call("endRun", {})).toMatchObject({ kind: "offline" });
      expect(await port.submitScore(5)).toMatchObject({ kind: "offline" });
      expect(calls).toEqual([]);
    }
  });
});
