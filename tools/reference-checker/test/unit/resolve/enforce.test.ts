import { describe, expect, it } from "vitest";
import { enforcePreference } from "../../../src/resolve/enforce.js";

describe("enforcePreference (FR-044)", () => {
  it("clamps 3 with max 2 → 2 and OT-CUS-101", () => {
    const result = enforcePreference(
      3,
      { kind: "range", min: 0, max: 2, step: 1 },
      1,
    );
    expect(result.value).toBe(2);
    expect(result.diagnostic).toBe("OT-CUS-101");
    expect(result.status).toBe("clamped");
  });

  it("snaps between steps, ties to the lower step", () => {
    // min 0, step 2; value 1 is halfway between 0 and 2 → lower (0)
    const result = enforcePreference(
      1,
      { kind: "range", min: 0, max: 10, step: 2 },
      0,
    );
    expect(result.value).toBe(0);
    expect(result.diagnostic).toBe("OT-CUS-101");
  });

  it("snaps to nearest when not a tie", () => {
    const result = enforcePreference(
      1.6,
      { kind: "range", min: 0, max: 10, step: 2 },
      0,
    );
    expect(result.value).toBe(2);
  });

  it("gamut-maps out-of-gamut color and forces alpha to 1", () => {
    const input = {
      colorSpace: "oklch",
      components: [0.7, 0.4, 250],
      alpha: 0.5,
    };
    const frozen = structuredClone(input);
    const result = enforcePreference(
      input,
      { kind: "color", gamut: "srgb", opaque: true },
      { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 },
    );
    expect(input).toEqual(frozen); // never mutated
    expect(result.status).toBe("clamped");
    expect(result.diagnostic).toBe("OT-CUS-101");
    const out = result.value as { alpha: number; colorSpace: string };
    expect(out.alpha).toBe(1);
    expect(out.colorSpace).toBe("srgb");
  });

  it("disallowed enum falls back with OT-CUS-102", () => {
    const result = enforcePreference(
      "purple",
      { kind: "enum", values: ["light", "dark"] },
      "light",
    );
    expect(result.value).toBe("light");
    expect(result.diagnostic).toBe("OT-CUS-102");
    expect(result.status).toBe("fallback");
  });

  it("malformed value falls back with OT-CUS-102", () => {
    const result = enforcePreference(
      "nope",
      { kind: "range", min: 0, max: 1, step: 0.1 },
      0.5,
    );
    expect(result.value).toBe(0.5);
    expect(result.diagnostic).toBe("OT-CUS-102");
  });

  it("does not mutate the input value object", () => {
    const input = { colorSpace: "srgb", components: [1.5, -0.1, 0.2], alpha: 0.3 };
    const before = JSON.stringify(input);
    enforcePreference(
      input,
      { kind: "color", gamut: "srgb", opaque: true },
      { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 },
    );
    expect(JSON.stringify(input)).toBe(before);
  });
});
