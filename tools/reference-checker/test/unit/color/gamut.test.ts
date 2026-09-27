import { describe, expect, it } from "vitest";
import { oklchToOklab } from "../../../src/color/oklch.js";
import { gamutMap, isInGamut } from "../../../src/color/gamut.js";

describe("gamut mapping", () => {
  it("maps an out-of-gamut OKLCH color into gamut within 24 iterations", () => {
    // High chroma blue-ish OKLCH that exceeds sRGB
    const lab = oklchToOklab({ L: 0.7, C: 0.4, H: 250, alpha: 1 });
    expect(isInGamut(lab)).toBe(false);
    const mapped = gamutMap(lab);
    expect(isInGamut(mapped)).toBe(true);
  });

  it("leaves in-gamut colors unchanged", () => {
    const lab = oklchToOklab({ L: 0.6, C: 0.05, H: 40, alpha: 1 });
    expect(isInGamut(lab)).toBe(true);
    const mapped = gamutMap(lab);
    expect(mapped.L).toBe(lab.L);
    expect(mapped.a).toBe(lab.a);
    expect(mapped.b).toBe(lab.b);
  });
});
