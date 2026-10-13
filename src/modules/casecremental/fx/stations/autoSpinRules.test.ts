import { describe, expect, it } from "vitest";
import { ARM_PULL_SECONDS, ARM_TURN_SECONDS, armFrame, armHit, LAMP_OFF, LAMP_ON, LAMP_WAIT, glowColor, lampColor } from "./autoSpinRules";

describe("the arm's rules", () => {
  it("rests after a reload (never), pulls after a buy, swings after the key; the latest wins", () => {
    expect(armFrame(Infinity, Infinity)).toBe(0);
    expect(armFrame(0.1, Infinity)).toBe(1);
    expect(armFrame(ARM_PULL_SECONDS, Infinity)).toBe(0);
    expect(armFrame(Infinity, 0.1)).toBe(2);
    expect(armFrame(Infinity, ARM_TURN_SECONDS)).toBe(0);
    expect(armFrame(0.2, 0.05)).toBe(2);
    expect(armFrame(0.05, 0.2)).toBe(1);
  });

  it("lights its lamp from the status; BROKE blinks at 2 Hz", () => {
    expect(lampColor("on", 0)).toBe(LAMP_ON);
    expect(lampColor("off", 0)).toBe(LAMP_OFF);
    expect(lampColor("vault", 0.3)).toBe(LAMP_WAIT);
    expect(lampColor("broke", 0)).toBe(LAMP_WAIT);
    expect(lampColor("broke", 0.3)).toBe(LAMP_OFF);
    expect(lampColor("broke", 0.5)).toBe(LAMP_WAIT);
  });

  it("keeps the HD glow steady when BROKE (a pulsing light changes by under 0.1 per beat)", () => {
    const lum = (c: number) => (((c >> 16) & 255) * 0.2126 + ((c >> 8) & 255) * 0.7152 + (c & 255) * 0.0722) / 255;
    const ls = [0, 0.1, 0.3, 0.5, 0.8].map((t) => lum(glowColor("broke", t)));
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThan(0.1);
    expect(glowColor("on", 0)).toBe(LAMP_ON);
  });

  it("takes a tap on the arm or 1 px around it", () => {
    const r = { x: 10, y: 20, w: 10, h: 18 };
    expect(armHit(r, { x: 9, y: 19 })).toBe(true);
    expect(armHit(r, { x: 20.5, y: 38.5 })).toBe(true);
    expect(armHit(r, { x: 8.9, y: 25 })).toBe(false);
    expect(armHit(r, { x: 15, y: 39.1 })).toBe(false);
  });
});
