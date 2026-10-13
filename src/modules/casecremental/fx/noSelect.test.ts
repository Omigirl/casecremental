import { describe, expect, it } from "vitest";
import { blockSelection } from "./noSelect";

describe("blockSelection", () => {
  it("turns off text selection and the iOS long-press callout on an element", () => {
    const set: Record<string, string> = {};
    blockSelection({ style: { setProperty: (k: string, v: string) => (set[k] = v) } });
    expect(set).toEqual({ "user-select": "none", "-webkit-user-select": "none", "-webkit-touch-callout": "none" });
  });

  it("does nothing to an element without a style (the tests' fake canvas)", () => {
    expect(() => blockSelection({})).not.toThrow();
  });
});
