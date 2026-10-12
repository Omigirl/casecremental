import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n/index";
import type { Drop } from "../sim/types";
import { binCalling, fitCentre, hintKey, revealLines, trayFull } from "./labels";

afterEach(() => setLang("en"));

const DROP: Drop = {
  id: 1,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.05,
  wear: "FN",
  statTrak: true,
  value: 7.5,
};

describe("canvas labels", () => {
  it("follows a language switch while the card is up", () => {
    expect(revealLines(DROP)).toEqual(["ST™ AK-Pew | Woodland Drill", "Factory New · $7.50"]);
    setLang("ru");
    expect(revealLines(DROP)).toEqual(["ST™ АК-Пиу | Лесные учения", "С завода · $7,50"]);
  });

  it("hints at the next step and stays quiet while the reel spins", () => {
    expect(hintKey({ phase: "empty" })).toBe("hint.buy");
    expect(hintKey({ phase: "locked", caseId: "bootcamp", free: false, count: 2 })).toBe("hint.key");
    const reel = { drop: DROP, tease: null, duration: 6 };
    expect(hintKey({ phase: "spinning", caseId: "bootcamp", reels: [reel, reel], elapsed: 1, fullDuration: 6 })).toBeNull();
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", cards: [DROP] })).toBe("hint.sell");
    expect(hintKey({ phase: "empty" }, false, true)).toBeNull(); // auto-spin buys and keys: no hint flashing every open
    expect(hintKey({ phase: "locked", caseId: "bootcamp", free: false, count: 1 }, false, true)).toBeNull();
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", cards: [DROP] }, false, true)).toBe("hint.sell");
  });

  it("hints at selling a single card, and stays quiet over a pair, even half-sold (it would cover their tops)", () => {
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", cards: [DROP, DROP] })).toBeNull();
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", cards: [null, DROP] })).toBeNull();
    expect(hintKey({ phase: "revealed", caseId: "bootcamp", cards: [DROP, null] })).toBeNull();
  });

  it("drops the single card's hint in portrait, where it would sit on the card's top", () => {
    const one = { phase: "revealed", caseId: "bootcamp", cards: [DROP] } as const;
    expect(hintKey(one, true)).toBeNull();
    expect(hintKey(one, false)).toBe("hint.sell");
    expect(hintKey({ phase: "empty" }, true)).toBe("hint.buy"); // no card up: the hint stays
    expect(hintKey({ phase: "locked", caseId: "bootcamp", free: false, count: 1 }, true)).toBe("hint.key");
  });

  it("keeps a centred line inside its span, as near the wanted centre as it fits", () => {
    expect(fitCentre(100, 40, 0, 300)).toBe(100); // fits where it is
    expect(fitCentre(30, 100, 0, 300)).toBe(50); // pushed off the left edge
    expect(fitCentre(290, 100, 0, 300)).toBe(250); // pushed off the right edge
    expect(fitCentre(30, 400, 0, 300)).toBe(150); // wider than the span: centred on it
  });
});

describe("trayFull", () => {
  const drop = DROP;
  it("is on only while the auto-seller is on and the tray is at capacity", () => {
    expect(trayFull({ seller: { on: true }, tray: [drop, drop] }, 2)).toBe(true);
    expect(trayFull({ seller: { on: true }, tray: [drop] }, 2)).toBe(false);
    expect(trayFull({ seller: { on: false }, tray: [drop, drop] }, 2)).toBe(false);
  });
});

describe("binCalling", () => {
  it("calls for a card waiting on your bench, at the bot's station or on the locker", () => {
    const empty = { phase: "empty" } as const;
    expect(binCalling({ bench: empty, bot: { cards: [] }, locker: { cards: [] } })).toBe(false);
    expect(binCalling({ bench: { phase: "revealed", caseId: "bootcamp", cards: [DROP] }, bot: { cards: [] }, locker: { cards: [] } })).toBe(
      true,
    );
    expect(binCalling({ bench: empty, bot: { cards: [null, DROP] }, locker: { cards: [] } })).toBe(true);
    expect(binCalling({ bench: empty, bot: { cards: [] }, locker: { cards: [null, DROP] } })).toBe(true);
  });
});
