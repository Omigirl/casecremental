import { describe, expect, it } from "vitest";
import { planFormat } from "./pre-commit.mjs";

describe("pre-commit formatting plan", () => {
  it("formats fully staged code files and leaves partly staged ones alone", () => {
    const plan = planFormat(["src/a.ts", "src/b b.tsx", "src/c.ts", "README.md", "art/x.png"], ["src/c.ts", "src/other.ts"]);
    expect(plan.format).toEqual(["src/a.ts", "src/b b.tsx"]);
    expect(plan.skipped).toEqual(["src/c.ts"]);
  });

  it("does nothing when no code is staged", () => {
    expect(planFormat([], [])).toEqual({ format: [], skipped: [] });
  });
});
