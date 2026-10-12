import { describe, expect, it } from "vitest";

// The tutorial finds its DOM targets by data-tut (ui/tutorialRules.ts TargetId); a mark lost in a panel edit would
// leave a bubble with nothing to point at, so the panels' sources must keep every mark.
const SOURCES = import.meta.glob("./*.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const all = Object.values(SOURCES).join("\n");

describe("the tutorial's marks in the panels", () => {
  it.each([
    'tut="vault"',
    'tut="wake"',
    'tut="seller"',
    'tut="autospin"',
    'tut="drawer:cases"',
    'tut="drawer:upgrades"',
    "tut={`tab:${id}`}",
    "tut={`case:${c.id}`}",
    "tut={`upgrade:${u.id}`}",
  ])("%s", (mark) => expect(all).toContain(mark));

  it("renders a mark as data-tut", () => expect(SOURCES["./parts.tsx"]).toContain("data-tut={props.tut}"));
});
