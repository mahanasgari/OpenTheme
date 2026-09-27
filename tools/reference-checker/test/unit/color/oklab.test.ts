import { describe, expect, it } from "vitest";
import { srgbToOklab, oklabToLinearSrgb } from "../../../src/color/oklab.js";

describe("OKLab", () => {
  it("maps sRGB white to L≈1, a≈0, b≈0", () => {
    const lab = srgbToOklab({ r: 1, g: 1, b: 1, alpha: 1 });
    expect(lab.L).toBeGreaterThan(0.999);
    expect(Math.abs(lab.a)).toBeLessThan(1e-6);
    expect(Math.abs(lab.b)).toBeLessThan(1e-6);
  });

  it("maps sRGB black to L≈0, a≈0, b≈0", () => {
    const lab = srgbToOklab({ r: 0, g: 0, b: 0, alpha: 1 });
    expect(lab.L).toBeLessThan(1e-6);
    expect(Math.abs(lab.a)).toBeLessThan(1e-6);
    expect(Math.abs(lab.b)).toBeLessThan(1e-6);
  });

  it("round-trips linear white through OKLab", () => {
    const lab = srgbToOklab({ r: 1, g: 1, b: 1, alpha: 1 });
    const lin = oklabToLinearSrgb(lab);
    expect(lin.r).toBeCloseTo(1, 5);
    expect(lin.g).toBeCloseTo(1, 5);
    expect(lin.b).toBeCloseTo(1, 5);
  });
});
