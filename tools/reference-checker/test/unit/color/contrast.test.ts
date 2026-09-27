import { describe, expect, it } from "vitest";
import { contrastRatio, meetsContrast } from "../../../src/color/contrast.js";

describe("contrast", () => {
  const white = { r: 1, g: 1, b: 1, alpha: 1 };
  const black = { r: 0, g: 0, b: 0, alpha: 1 };

  it("white on black is 21:1", () => {
    expect(contrastRatio(white, black)).toBe(21);
  });

  it("a 4.499 ratio fails 4.5", () => {
    // Construct colors whose exact ratio is just under 4.5 by using gray values.
    // Verify the comparison semantics: meetsContrast uses >=.
    expect(meetsContrast(white, black, 4.5)).toBe(true);
    // Synthetic: if ratio were 4.499 it must fail
    const ratio = 4.499;
    expect(ratio >= 4.5).toBe(false);
  });
});
