import { describe, expect, it } from "vitest";
import { pickValue } from "../src/path.js";

const resolved = {
  tokens: { "color.text.primary": { srgb8: [1, 2, 3], alpha: 1 }, "space.4": { value: 16, unit: "px" } },
  components: {
    "std/button": {
      container: { background: { default: "a", hover: "b" } },
      $variants: { size: "m" },
    },
  },
};

describe("pickValue", () => {
  it("returns a token by its path", () => {
    expect(pickValue(resolved, "color.text.primary")).toBe(resolved.tokens["color.text.primary"]);
    expect(pickValue(resolved, "space.4")).toBe(resolved.tokens["space.4"]);
  });
  it("returns a component value by contract, part, property, and state", () => {
    expect(pickValue(resolved, "std/button.container.background.default")).toBe("a");
    expect(pickValue(resolved, "std/button.container.background.hover")).toBe("b");
  });
  it("returns a sub-tree when the state is omitted", () => {
    expect(pickValue(resolved, "std/button.container.background")).toBe(resolved.components["std/button"].container.background);
  });
  it("returns undefined for unknown paths instead of throwing", () => {
    for (const p of ["", "nope", "color.text", "std/button", "std/button.container.nope", "std/missing.container.x", "/button.a.b", "std/button.container.background.default.deeper"]) {
      expect(pickValue(resolved, p), p).toBeUndefined();
    }
  });
  it("does not read inherited properties", () => {
    expect(pickValue(resolved, "constructor")).toBeUndefined();
    expect(pickValue(resolved, "std/button.container.toString")).toBeUndefined();
    expect(pickValue(resolved, "__proto__")).toBeUndefined();
  });
  it("returns undefined for malformed input", () => {
    expect(pickValue(null, "a")).toBeUndefined();
    expect(pickValue({}, "std/button.a.b")).toBeUndefined();
  });
});
