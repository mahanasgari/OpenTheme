import { describe, expect, it } from "vitest";
import { srgbToOklab } from "../../../src/color/oklab.js";
import {
  colorContrastAdjust,
  colorMix,
  colorMixBounded,
  colorHue,
  colorLightness,
  colorChroma,
  colorAlpha,
  colorComposite,
  colorContrastSelect,
  meetsAllBackgrounds,
  toQuantizedSrgb,
} from "../../../src/transforms/color.js";

const white = srgbToOklab({ r: 1, g: 1, b: 1, alpha: 1 });
const black = srgbToOklab({ r: 0, g: 0, b: 0, alpha: 1 });
const gray = srgbToOklab({ r: 0.5, g: 0.5, b: 0.5, alpha: 1 });

describe("color transforms", () => {
  it("mix at 0 and 1 returns endpoints", () => {
    const a = colorMix(black, white, 0);
    const b = colorMix(black, white, 1);
    expect(a.L).toBeCloseTo(black.L, 5);
    expect(b.L).toBeCloseTo(white.L, 5);
  });

  it("lightness / chroma / hue / alpha are total", () => {
    expect(colorLightness(gray, 0.2).L).toBeGreaterThan(gray.L);
    expect(colorChroma(gray, 0).a).toBe(0);
    const hued = colorHue(srgbToOklab({ r: 1, g: 0, b: 0, alpha: 1 }), 90);
    expect(Number.isFinite(hued.a)).toBe(true);
    expect(colorAlpha(gray, 0.25).alpha).toBe(0.25);
  });

  it("composite yields opaque color", () => {
    const out = colorComposite(
      { ...srgbToOklab({ r: 1, g: 0, b: 0, alpha: 1 }), alpha: 0.5 },
      black,
    );
    expect(out.alpha).toBe(1);
  });

  it("contrast-select picks first meeting target", () => {
    const pick = colorContrastSelect([white], [gray, black], 4.5);
    expect(meetsAllBackgrounds(pick, [white], 4.5)).toBe(true);
  });
});

describe("A1 contrast-adjust", () => {
  it("returns the input when it already passes", () => {
    const out = colorContrastAdjust(black, [white], 4.5);
    expect(out.L).toBeCloseTo(black.L, 5);
  });

  it("reaches 4.5 against a single opaque background", () => {
    const out = colorContrastAdjust(gray, [white], 4.5);
    expect(meetsAllBackgrounds(out, [white], 4.5)).toBe(true);
  });

  it("bisects exactly and prefers the closer passing probe", () => {
    const out = colorContrastAdjust(gray, [black], 4.5);
    expect(meetsAllBackgrounds(out, [black], 4.5)).toBe(true);
  });
});

describe("A2 mix-bounded", () => {
  it("returns m(ratio) when it already passes", () => {
    const out = colorMixBounded(black, white, 1, white, 4.5);
    expect(meetsAllBackgrounds(out, [white], 4.5)).toBe(true);
  });

  it("returns color unchanged when m(0) misses", () => {
    // gray on gray will miss; m(0)=gray
    const out = colorMixBounded(gray, white, 0.5, gray, 7);
    expect(out.L).toBeCloseTo(gray.L, 3);
  });

  it("returns the largest passing t", () => {
    const out = colorMixBounded(black, gray, 1, white, 4.5);
    expect(meetsAllBackgrounds(out, [white], 4.5)).toBe(true);
  });
});

describe("quantized output", () => {
  it("toQuantizedSrgb channels stay in range", () => {
    const q = toQuantizedSrgb(gray);
    expect(q.r).toBeGreaterThanOrEqual(0);
    expect(q.r).toBeLessThanOrEqual(1);
  });
});
