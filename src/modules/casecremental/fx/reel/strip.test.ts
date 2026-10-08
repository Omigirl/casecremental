import { describe, expect, it } from "vitest";
import { caseById } from "../../sim/content/cases";
import { createRng } from "../../sim/rng";
import { buildStrip, landingJitter, STRIP_LENGTH, WIN_INDEX } from "./strip";

const c = caseById("bootcamp");
const milspec = c.skins.find((s) => s.rarity === "milspec")!;
const knife = c.skins.find((s) => s.rarity === "gold")!;

describe("buildStrip", () => {
  it("places the winner at WIN_INDEX among skins of the same case", () => {
    const strip = buildStrip(c, milspec, createRng(1), null);
    expect(strip).toHaveLength(STRIP_LENGTH);
    expect(strip[WIN_INDEX]).toBe(milspec);
    for (const s of strip) expect(c.skins).toContain(s);
  });

  it("plants a fake tease's decoy right beside the winner: ahead when short, behind when over", () => {
    expect(buildStrip(c, milspec, createRng(2), { rarity: "gold", side: "short" })[WIN_INDEX + 1]!.rarity).toBe("gold");
    expect(buildStrip(c, milspec, createRng(2), { rarity: "covert", side: "over" })[WIN_INDEX - 1]!.rarity).toBe("covert");
  });

  it("never changes the winner, even for a knife", () => {
    expect(buildStrip(c, knife, createRng(3), null)[WIN_INDEX]).toBe(knife);
  });
});

describe("landingJitter", () => {
  it("stops a sliver short of a decoy ahead, or a sliver past one behind — never on it", () => {
    const rng = createRng(4);
    for (let i = 0; i < 500; i++) {
      const short = landingJitter("short", rng);
      const over = landingJitter("over", rng);
      expect(short).toBeGreaterThan(0.38);
      expect(short).toBeLessThan(0.5);
      expect(over).toBeLessThan(-0.38);
      expect(over).toBeGreaterThan(-0.5);
      expect(Math.abs(landingJitter(null, rng))).toBeLessThanOrEqual(0.35);
    }
  });
});
