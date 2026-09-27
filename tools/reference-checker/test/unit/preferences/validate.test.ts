import { describe, expect, it } from "vitest";
import {
  isPermittedLiteral,
  validatePreferences,
} from "../../../src/preferences/validate.js";

const base = { openthemePreferences: "1.0", selection: null, previous: null, values: {} };
const codes = (r: ReturnType<typeof validatePreferences>) =>
  r.diagnostics.map((d) => `${d.code} ${d.location.pointer}`);

describe("User Preferences document validation (chapter 18)", () => {
  it("accepts the minimal document", () => {
    expect(validatePreferences(base)).toMatchObject({ usable: true, values: {}, diagnostics: [] });
  });

  it("drops only non-literal values and keeps the document usable", () => {
    const r = validatePreferences({
      ...base,
      values: { "std.text-size": 1.2, "std.accent": { $ref: "x" }, tint: "a‮b" },
    });
    expect(r.usable).toBe(true);
    expect(r.values).toEqual({ "std.text-size": 1.2 });
    expect(codes(r)).toEqual(["OT-PREF-008 /values/std.accent", "OT-PREF-008 /values/tint"]);
  });

  it("treats a __proto__ member as an unknown member without polluting prototypes", () => {
    const r = validatePreferences(
      '{"openthemePreferences":"1.0","selection":null,"previous":null,"values":{},"__proto__":{"polluted":true}}',
    );
    expect(r.usable).toBe(false);
    expect(codes(r)).toEqual(["OT-PREF-005 /__proto__"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("enforces the byte limit before parsing, with bounded effort", () => {
    const huge = `{"x":"${"a".repeat(10 * 1024 * 1024)}"}`;
    const t0 = performance.now();
    const r = validatePreferences(huge);
    expect(performance.now() - t0).toBeLessThan(250);
    expect(codes(r)).toEqual(["OT-PREF-002 "]);
  });

  it("reports every document-level error in one pass", () => {
    const r = validatePreferences({
      openthemePreferences: "2.0",
      selection: { id: "BAD" },
      values: { "Bad Key": 1 },
      extra: true,
    });
    expect(r.usable).toBe(false);
    expect(codes(r)).toEqual([
      "OT-PREF-005 /extra",
      "OT-PREF-004 /openthemePreferences",
      "OT-PREF-005 /previous",
      "OT-PREF-006 /selection",
      "OT-PREF-007 /values/Bad Key",
    ]);
  });

  it("classifies permitted literals", () => {
    for (const v of [0, -1.5, true, "dark", { colorSpace: "srgb", components: [0, 0, 0] }]) {
      expect(isPermittedLiteral(v)).toBe(true);
    }
    for (const v of [null, [1], {}, "x".repeat(257), { colorSpace: "hsl", components: [0, 0, 0] }]) {
      expect(isPermittedLiteral(v as never)).toBe(false);
    }
  });
});
