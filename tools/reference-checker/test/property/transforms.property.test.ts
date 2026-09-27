import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { srgbToOklab } from "../../src/color/oklab.js";
import {
  colorContrastAdjust,
  colorMix,
  colorLightness,
  colorChroma,
  colorHue,
  colorAlpha,
  meetsAllBackgrounds,
  toQuantizedSrgb,
} from "../../src/transforms/color.js";
import {
  numberScale,
  numberAdd,
  numberClamp,
  dimensionRound,
} from "../../src/transforms/number.js";

const srgbArb = fc
  .tuple(
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1, noNaN: true }),
  )
  .map(([r, g, b]) => srgbToOklab({ r, g, b, alpha: 1 }));

describe("transform properties", () => {
  it("color ops are total and stay finite", () => {
    fc.assert(
      fc.property(
        srgbArb,
        fc.double({ min: -1, max: 1, noNaN: true }),
        (c, d) => {
          const out = colorLightness(c, d);
          return Number.isFinite(out.L) && Number.isFinite(out.a);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("mix ratio 0/1 is bit-stable on repeated calls", () => {
    fc.assert(
      fc.property(srgbArb, srgbArb, (a, b) => {
        const x = colorMix(a, b, 0);
        const y = colorMix(a, b, 0);
        return x.L === y.L && x.a === y.a && x.b === y.b;
      }),
      { numRuns: 30 },
    );
  });

  it("quantized outputs stay in [0,1]", () => {
    fc.assert(
      fc.property(srgbArb, (c) => {
        const q = toQuantizedSrgb(colorChroma(c, 2));
        return q.r >= 0 && q.r <= 1 && q.g >= 0 && q.g <= 1 && q.b >= 0 && q.b <= 1;
      }),
      { numRuns: 30 },
    );
  });

  it("contrast-adjust reaches every target ≤ 4.5 against one opaque bg", () => {
    fc.assert(
      fc.property(
        srgbArb,
        srgbArb,
        fc.double({ min: 1, max: 4.5, noNaN: true }),
        (fg, bg, target) => {
          const out = colorContrastAdjust(fg, [bg], target);
          return meetsAllBackgrounds(out, [bg], target);
        },
      ),
      { numRuns: 25 },
    );
  });

  it("number ops stay finite", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e3, max: 1e3, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (v, f) => Number.isFinite(numberScale(v, f)),
      ),
      { numRuns: 50 },
    );
    expect(numberAdd(1, 2)).toBe(3);
    expect(numberClamp(5, 0, 1)).toBe(1);
    expect(
      dimensionRound({ value: 2.5, unit: "px" }, { value: 1, unit: "px" }).value,
    ).toBe(2);
  });

  it("hue rotation is deterministic", () => {
    const c = srgbToOklab({ r: 0.8, g: 0.2, b: 0.1, alpha: 1 });
    const a = colorHue(c, 33);
    const b = colorHue(c, 33);
    expect(a.a).toBe(b.a);
    expect(a.b).toBe(b.b);
    expect(colorAlpha(c, 0.5).alpha).toBe(0.5);
  });
});
