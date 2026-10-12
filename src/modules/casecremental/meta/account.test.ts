import { describe, expect, it } from "vitest";
import { accountKey, adoptLegacy } from "./account";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};

describe("account storage", () => {
  it("keys by account, and keeps the bare key when no one is signed in", () => {
    expect(accountKey("casecremental.save", "U1")).toBe("casecremental.save.U1");
    expect(accountKey("casecremental.save", null)).toBe("casecremental.save");
  });

  it("gives the browser's unkeyed copy to the first account that loads, once", () => {
    const s = memory();
    s.setItem("k", "old");
    adoptLegacy(s, "k", "A");
    expect(s.m.get("k.A")).toBe("old");
    expect(s.m.has("k")).toBe(false);
    adoptLegacy(s, "k", "B");
    expect(s.m.has("k.B")).toBe(false); // the second account starts on its own
  });

  it("never overwrites an account's own copy", () => {
    const s = memory();
    s.setItem("k", "old");
    s.setItem("k.A", "mine");
    adoptLegacy(s, "k", "A");
    expect(s.m.get("k.A")).toBe("mine");
    expect(s.m.has("k")).toBe(false);
  });

  it("does nothing without storage or an account, and survives blocked storage", () => {
    const s = memory();
    s.setItem("k", "old");
    adoptLegacy(s, "k", null);
    adoptLegacy(null, "k", "A");
    expect(s.m.get("k")).toBe("old");
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem() {},
      removeItem() {},
    };
    expect(() => adoptLegacy(blocked, "k", "A")).not.toThrow();
  });
});
