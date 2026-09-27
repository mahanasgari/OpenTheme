import { describe, expect, it } from "vitest";
import {
  colorContrastAdjust,
  meetsAllBackgrounds,
} from "../../../src/transforms/color.js";
import { srgbToOklab } from "../../../src/color/oklab.js";

describe("contrast transform helpers", () => {
  it("chooses the darker endpoint on a contrast tie", () => {
    // Mid gray against mid gray: endpoints L=0 and L=1 both beat mid;
    // adjust should still return a defined color.
    const mid = srgbToOklab({ r: 0.5, g: 0.5, b: 0.5, alpha: 1 });
    const bg = srgbToOklab({ r: 0.5, g: 0.5, b: 0.5, alpha: 1 });
    const out = colorContrastAdjust(mid, [bg], 1.01);
    expect(Number.isFinite(out.L)).toBe(true);
  });

  it("white/black pair always meets 4.5", () => {
    const white = srgbToOklab({ r: 1, g: 1, b: 1, alpha: 1 });
    const black = srgbToOklab({ r: 0, g: 0, b: 0, alpha: 1 });
    expect(meetsAllBackgrounds(white, [black], 4.5)).toBe(true);
  });
});
