import { describe, expect, it } from "vitest";
import {
  numberScale,
  numberAdd,
  numberClamp,
  dimensionScale,
  dimensionAdd,
  dimensionClamp,
  dimensionRound,
  inDomain,
  clampToDomain,
  clampToRange,
} from "../../../src/transforms/number.js";
import {
  getTransform,
  loadTransformRegistry,
} from "../../../src/transforms/registry.js";
import { EffortCounter, EFFORT_BUDGET } from "../../../src/transforms/effort.js";

describe("number transforms", () => {
  it("scale / add / clamp", () => {
    expect(numberScale(10, 2)).toBe(20);
    expect(numberAdd(10, -3)).toBe(7);
    expect(numberClamp(5, 0, 1)).toBe(1);
  });

  it("dimension ops", () => {
    expect(dimensionScale({ value: 10, unit: "px" }, 2).value).toBe(20);
    expect(
      dimensionAdd({ value: 10, unit: "px" }, { value: 5, unit: "px" }).value,
    ).toBe(15);
    expect(
      dimensionClamp(
        { value: 50, unit: "px" },
        { value: 0, unit: "px" },
        { value: 10, unit: "px" },
      ).value,
    ).toBe(10);
    expect(
      dimensionRound({ value: 7.5, unit: "px" }, { value: 1, unit: "px" }).value,
    ).toBe(8);
  });

  it("domain checks map to OT-DRV-004 / OT-DRV-102 semantics", () => {
    expect(inDomain(1.5, { min: 0, max: 1 })).toBe(false); // OT-DRV-004
    expect(clampToDomain(1.5, { min: 0, max: 1 })).toEqual({
      value: 1,
      clamped: true,
    }); // OT-DRV-102
    expect(clampToRange(999, { max: 100 })).toEqual({
      value: 100,
      clamped: true,
    }); // OT-DRV-101
  });
});

describe("transform registry + effort", () => {
  it("loads all 16 transformations", () => {
    const reg = loadTransformRegistry();
    expect(reg.size).toBe(16);
    expect(getTransform("color.contrast-adjust")?.effortCost).toBe(48);
  });

  it("flags effort over 200000 with OT-DRV-007", () => {
    const c = new EffortCounter();
    c.add(EFFORT_BUDGET);
    expect(c.isExceeded).toBe(false);
    c.add(1);
    expect(c.isExceeded).toBe(true);
    expect(EffortCounter.CODE).toBe("OT-DRV-007");
  });
});
