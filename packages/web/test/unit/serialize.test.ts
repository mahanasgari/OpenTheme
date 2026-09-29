/** Value serialization contract (contracts/css-output.md "Values"; FR-W003, T007). */
import { describe, expect, it } from "vitest";
import { GENERIC_FAMILIES, SYSTEM_COLORS } from "../../src/generated/registry.js";
import { generatedSource } from "../../scripts/generate.js";
import { isCompositeValue, serializeLeaf, serializeShorthand } from "../../src/serialize.js";
import { read } from "../helpers.js";

describe("colors", () => {
  it("opaque sRGB uses rgb(r g b)", () => expect(serializeLeaf({ srgb8: [12, 0, 255], alpha: 1 })).toBe("rgb(12 0 255)"));
  it("translucent sRGB adds the alpha", () => expect(serializeLeaf({ srgb8: [1, 2, 3], alpha: 0.125 })).toBe("rgb(1 2 3 / 0.125)"));
  it("rejects out-of-range or non-integer channels", () => {
    expect(serializeLeaf({ srgb8: [256, 0, 0], alpha: 1 })).toBeNull();
    expect(serializeLeaf({ srgb8: [1.5, 0, 0], alpha: 1 })).toBeNull();
    expect(serializeLeaf({ srgb8: [1, 0], alpha: 1 })).toBeNull();
    expect(serializeLeaf({ srgb8: [1, 0, 0], alpha: 2 })).toBeNull();
    expect(serializeLeaf({ srgb8: [1, 0, 0], alpha: 1, extra: true })).toBeNull();
  });
  it("every forced-colors role maps to its CSS system color", () => {
    const forced = JSON.parse(read("specification/registry/1.0/forced-colors.json")) as {
      roles: { id: string; cssSystemColorHint: string }[];
    };
    expect(forced.roles).toHaveLength(9);
    for (const r of forced.roles) expect(serializeLeaf({ system: r.id })).toBe(r.cssSystemColorHint);
    expect(serializeLeaf({ system: "constructor" })).toBeNull();
    expect(serializeLeaf({ system: "Canvas" })).toBeNull();
  });
  it("the embedded registry data is current", () => {
    expect(read("packages/web/src/generated/registry.ts")).toBe(generatedSource());
    expect(Object.keys(SYSTEM_COLORS)).toHaveLength(9);
    expect(GENERIC_FAMILIES.has("sans-serif")).toBe(true);
  });
});

describe("dimensions, durations, numbers", () => {
  it.each([
    [{ value: 16, unit: "px" }, "16px"],
    [{ value: -0.5, unit: "px" }, "-0.5px"],
    [{ value: 120, unit: "ms" }, "120ms"],
    [{ number: 1.25 }, "1.25"],
    [400, "400"],
    [{ number: 1e-7 }, "1e-7"],
    [{ value: 1e21, unit: "px" }, "1e+21px"],
    [0.1 + 0.2, "0.30000000000000004"],
  ])("%j → %s", (v, text) => {
    expect(serializeLeaf(v)).toBe(text);
    const n = Number(text.replace(/px|ms$/, ""));
    const expected = typeof v === "number" ? v : "number" in v ? v.number : v.value;
    expect(Object.is(n, expected)).toBe(true);
  });
  it("rejects other units and non-finite values", () => {
    expect(serializeLeaf({ value: 1, unit: "em" })).toBeNull();
    expect(serializeLeaf({ value: "1", unit: "px" })).toBeNull();
    expect(serializeLeaf(Number.NaN)).toBeNull();
    expect(serializeLeaf({ number: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe("font families", () => {
  it("quotes names and leaves generic families bare", () => {
    expect(serializeLeaf({ families: ["Inter", "Times New Roman", "system-ui", "sans-serif"] })).toBe(
      '"Inter", "Times New Roman", system-ui, sans-serif',
    );
  });
  it("rejects names outside the family-name grammar", () => {
    expect(serializeLeaf({ families: ['Evil"; } body { x', "serif"] })).toBeNull();
    expect(serializeLeaf({ families: ["a\\b", "serif"] })).toBeNull();
    expect(serializeLeaf({ families: ["Line\nBreak"] })).toBeNull();
    expect(serializeLeaf({ families: [] })).toBeNull();
    expect(serializeLeaf({ families: { default: ["serif"] } })).toBeNull();
  });
});

describe("other shapes", () => {
  it("cubic Bézier", () => expect(serializeLeaf([0.4, 0, 0.2, 1])).toBe("cubic-bezier(0.4, 0, 0.2, 1)"));
  it("stroke styles", () => {
    for (const k of ["solid", "dashed", "dotted"]) expect(serializeLeaf(k)).toBe(k);
    expect(serializeLeaf("double")).toBeNull();
    expect(serializeLeaf("red; x: y")).toBeNull();
  });
  it("unsupported shapes are null", () => {
    for (const v of [null, true, "linear-gradient(red, blue)", [1, 2, 3], { stops: [] }, {}]) expect(serializeLeaf(v)).toBeNull();
  });
});

describe("composites", () => {
  const border = { width: { value: 1, unit: "px" }, style: "solid", color: { srgb8: [0, 0, 0], alpha: 1 } };
  const shadow = {
    offsetX: { value: 0, unit: "px" },
    offsetY: { value: 2, unit: "px" },
    blur: { value: 4, unit: "px" },
    spread: { value: 0, unit: "px" },
    color: { srgb8: [0, 0, 0], alpha: 0.2 },
  };
  it("recognizes composites", () => {
    expect(isCompositeValue(border)).toBe(true);
    expect(isCompositeValue({ number: 1 })).toBe(false);
    expect(isCompositeValue({ srgb8: [0, 0, 0], alpha: 1 })).toBe(false);
    expect(isCompositeValue({ stops: [], angle: 90 })).toBe(false);
    expect(isCompositeValue({ width: { value: 1, unit: "px" }, angle: 90 })).toBe(false);
  });
  it("border and shadow shorthands", () => {
    expect(serializeShorthand(border)).toBe("1px solid rgb(0 0 0)");
    expect(serializeShorthand({ ...border, physical: true })).toBe("1px solid rgb(0 0 0)");
    expect(serializeShorthand(shadow)).toBe("0px 2px 4px 0px rgb(0 0 0 / 0.2)");
  });
  it("typography and incomplete composites have no shorthand", () => {
    expect(serializeShorthand({ fontSize: { value: 14, unit: "px" }, lineHeight: 1.3 })).toBeNull();
    expect(serializeShorthand({ width: { value: 1, unit: "px" }, style: "solid" })).toBeNull();
  });
});
