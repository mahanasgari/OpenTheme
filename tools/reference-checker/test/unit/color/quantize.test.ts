import { describe, expect, it } from "vitest";
import {
  quantizeChannel,
  roundHalfEven,
} from "../../../src/color/quantize.js";

describe("quantize", () => {
  it("round-half-even: 0.3 → channel 76", () => {
    // 0.3 * 255 = 76.5 → ties to even 76
    expect(roundHalfEven(0.3 * 255)).toBe(76);
    expect(quantizeChannel(0.3)).toBe(76 / 255);
  });

  it("round-half-even: 0.5 → 0 (even), 1.5 → 2 (even)", () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
  });
});
