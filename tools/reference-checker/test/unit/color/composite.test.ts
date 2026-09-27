import { describe, expect, it } from "vitest";
import { compositeSourceOver } from "../../../src/color/composite.js";

describe("composite", () => {
  it("source-over in gamma-encoded sRGB onto opaque backdrop", () => {
    const src = { r: 1, g: 0, b: 0, alpha: 0.5 };
    const bg = { r: 0, g: 0, b: 1, alpha: 1 };
    const out = compositeSourceOver(src, bg);
    expect(out.alpha).toBe(1);
    expect(out.r).toBeCloseTo(0.5, 10);
    expect(out.g).toBeCloseTo(0, 10);
    expect(out.b).toBeCloseTo(0.5, 10);
  });

  it("opaque source replaces backdrop", () => {
    const src = { r: 0.2, g: 0.3, b: 0.4, alpha: 1 };
    const bg = { r: 1, g: 1, b: 1, alpha: 1 };
    const out = compositeSourceOver(src, bg);
    expect(out.r).toBe(0.2);
    expect(out.g).toBe(0.3);
    expect(out.b).toBe(0.4);
  });
});
