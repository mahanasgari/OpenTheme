import { describe, expect, it } from "vitest";
import { canonicalize } from "../../../src/canonical/jcs.js";

describe("JCS (RFC 8785)", () => {
  it("serializes primitives", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(false)).toBe("false");
    expect(canonicalize(1)).toBe("1");
    expect(canonicalize(0)).toBe("0");
    expect(canonicalize(-0)).toBe("0");
    expect(canonicalize("")).toBe('""');
  });

  it("sorts object keys lexicographically by UTF-16 code units", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalize([1, { z: 1, a: 2 }, "x"])).toBe(
      '[1,{"a":2,"z":1},"x"]',
    );
  });

  it("escapes control characters", () => {
    expect(canonicalize("a\nb")).toBe('"a\\nb"');
  });

  // Selected vectors inspired by RFC 8785 examples
  it("matches RFC 8785-style nested object vector", () => {
    const input = {
      numbers: [333333333.33333329, 1e30, 4.5],
      string: "\u20ac$\u000f\u000aA'\u0042\u0022\u005c\\\"\/",
      literals: [null, true, false],
    };
    const out = canonicalize(input);
    expect(out.startsWith("{")).toBe(true);
    expect(out).toContain('"literals":[null,true,false]');
    expect(out).toContain('"numbers":[');
    expect(out.indexOf('"literals"')).toBeLessThan(out.indexOf('"numbers"'));
    expect(out.indexOf('"numbers"')).toBeLessThan(out.indexOf('"string"'));
  });
});
