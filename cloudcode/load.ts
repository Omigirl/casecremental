import { readFileSync } from "node:fs";

// Loads the CloudCode the way the platform runs it: DATA prepended (as tools/cloud/bundle.mjs does), `handlers`,
// `server` and `log` as globals. Returns the handlers plus the internals the tests reach for.

export interface Loaded {
  handlers: Record<string, (args: unknown, context: unknown) => any>;
  RULES: Record<string, (io: FakeIo["io"], args: any) => any>;
  makeIo: (server: unknown, context: unknown) => FakeIo["io"];
}

export function loadCloud(server: unknown = {}, log = { Info() {}, Warning() {}, Error() {} }): Loaded {
  const data = readFileSync(new URL("./data.json", import.meta.url), "utf8");
  const code = readFileSync(new URL("./casecremental.js", import.meta.url), "utf8");
  const handlers = {};
  const inner = new Function("handlers", "server", "log", `var DATA = ${data};\n${code}\nreturn { RULES: RULES, makeIo: makeIo };`)(
    handlers,
    server,
    log,
  );
  return { handlers, ...inner };
}

/** An in-memory player: CLOUT, owned trophies, the three user-data buckets, the clock. */
export function fakeIo(now = 1_000_000) {
  const st = {
    t: now,
    clout: 0,
    owned: [] as string[],
    data: { ReadOnly: {}, Internal: {}, Public: {} } as Record<string, Record<string, unknown>>,
    ops: [] as Array<{ op: any; reason: string }>,
    failWrites: false,
  };
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const io = {
    userId: "U1",
    now: () => st.t,
    readData: (bucket: string, key: string) => (key in st.data[bucket]! ? copy(st.data[bucket]![key]) : null),
    writeData: (bucket: string, key: string, v: unknown) => {
      if (st.failWrites) return false;
      st.data[bucket]![key] = copy(v);
      return true;
    },
    clout: () => st.clout,
    ownedTrophies: () => [...st.owned],
    apply: (op: any, reason: string) => {
      st.ops.push({ op: copy(op), reason });
      for (const e of op.Consume?.Standard?.Entries ?? []) if (e.CurrencyID === "CLOUT" && st.clout < e.Amount) return false;
      for (const e of op.Consume?.Standard?.Entries ?? []) if (e.CurrencyID === "CLOUT") st.clout -= e.Amount;
      for (const e of op.Grant?.Standard?.Entries ?? []) {
        if (e.Type === "VirtualCurrency" && e.CurrencyID === "CLOUT") st.clout += e.Amount;
        if (e.Type === "Item") st.owned.push(e.ItemID);
      }
      return true;
    },
  };
  return { io, st };
}
export type FakeIo = ReturnType<typeof fakeIo>;
