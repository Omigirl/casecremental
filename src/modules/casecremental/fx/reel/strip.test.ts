import { describe, expect, it } from "vitest";
import { caseById } from "../../sim/content/cases";
import { createRng } from "../../sim/rng";
import { buildStrip, STRIP_LENGTH, WIN_INDEX } from "./strip";

const c = caseById("bootcamp");
const milspec = c.skins.find((s) => s.rarity === "milspec")!;
const knife = c.skins.find((s) => s.rarity === "gold")!;

describe("buildStrip", () => {
  it("places the winner at WIN_INDEX among skins of the same case", () => {
    const strip = buildStrip(c, milspec, createRng(1));
    expect(strip).toHaveLength(STRIP_LENGTH);
    expect(strip[WIN_INDEX]).toBe(milspec);
    for (const s of strip) expect(c.skins).toContain(s);
  });

  it("teases a near miss (knife one slot past) about 35% of the time", () => {
    const rng = createRng(2);
    let teases = 0;
    for (let i = 0; i < 4000; i++) if (buildStrip(c, milspec, rng)[WIN_INDEX + 1] === knife) teases++;
    expect(teases / 4000).toBeGreaterThan(0.3);
    expect(teases / 4000).toBeLessThan(0.4);
  });

  it("never changes the winner, even for a knife", () => {
    expect(buildStrip(c, knife, createRng(3))[WIN_INDEX]).toBe(knife);
  });
});
