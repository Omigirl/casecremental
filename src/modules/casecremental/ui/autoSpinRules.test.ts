import { describe, expect, it } from "vitest";
import { AUTOSPIN_DELAYS } from "../sim/tuning";
import { delaySeconds, statusKey } from "./autoSpinRules";

describe("auto-spin's rows", () => {
  it("say what it is doing", () => {
    expect(statusKey("off")).toBe("autospin.idle");
    expect(statusKey("on")).toBe("autospin.running");
    expect(statusKey("broke")).toBe("autospin.broke");
    expect(statusKey("vault")).toBe("autospin.vault");
  });

  it("print each delay short, with a decimal comma in Russian", () => {
    expect(AUTOSPIN_DELAYS.map((s) => delaySeconds(s, "en"))).toEqual(["1.5", "1.1", "0.8", "0.55", "0.35", "0.2"]);
    expect(delaySeconds(0.55, "ru")).toBe("0,55");
    expect(delaySeconds(1.5, "ru")).toBe("1,5");
  });
});
