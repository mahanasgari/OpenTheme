import { describe, expect, it } from "vitest";
import { validateThemeObject } from "../../../src/validate/document.js";

const base = {
  opentheme: "1.0",
  id: "uid.abcdefghijklmnopqrstuv2345",
  version: "1.0.0",
  name: "Quiet Paper",
  provenance: { origin: "user-created" },
  compatibility: { catalog: "1.0" },
  colorSchemes: { supported: ["light"], default: "light" },
  seeds: {
    light: {
      background: { colorSpace: "srgb", components: [0.98, 0.97, 0.95] },
      foreground: { colorSpace: "srgb", components: [0.12, 0.12, 0.14] },
      accent: { colorSpace: "oklch", components: [0.55, 0.15, 250] },
    },
    fontFamily: ["Inter", "system-ui", "sans-serif"],
  },
};

describe("validate components", () => {
  it("unknown catalog-style contract → OT-CMP-001 info", () => {
    const result = validateThemeObject({
      ...base,
      components: {
        "std/not-a-real-contract": {
          container: { background: { $value: "{seed.accent}" } },
        },
      },
    });
    const d = result.diagnostics.find((x) => x.code === "OT-CMP-001");
    expect(d).toBeDefined();
    expect(d?.severity).toBe("info");
  });

  it("host-extension contract without host is deferred (no CMP-001)", () => {
    const result = validateThemeObject({
      ...base,
      components: {
        "com.example/widget": {
          container: { background: { $value: "{seed.accent}" } },
        },
      },
    });
    expect(result.diagnostics.some((x) => x.code === "OT-CMP-001")).toBe(false);
  });

  it("unknown part → OT-CMP-003", () => {
    const result = validateThemeObject({
      ...base,
      components: {
        "std/button": { notAPart: { background: { $value: "{seed.accent}" } } },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CMP-003")).toBe(true);
  });

  it("undeclared state → OT-CMP-004", () => {
    const result = validateThemeObject({
      ...base,
      components: {
        "std/button": {
          container: {
            background: {
              $states: { spooky: { $value: "{seed.accent}" } },
            },
          },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CMP-004")).toBe(true);
  });
});

describe("validate customization", () => {
  it("text-size min < 1 → OT-CUS-005", () => {
    const result = validateThemeObject({
      ...base,
      customizationPoints: [
        {
          id: "std.text-size",
          type: "number",
          target: ["text.scale"],
          constraints: { range: { min: 0.9, max: 2, step: 0.1 } },
        },
      ],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CUS-005")).toBe(true);
  });

  it("non-integer steps → OT-CUS-004", () => {
    const result = validateThemeObject({
      ...base,
      customizationPoints: [
        {
          id: "custom.scale",
          type: "number",
          target: ["radius.factor"],
          constraints: { range: { min: 0, max: 1, step: 0.3 } },
        },
      ],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CUS-004")).toBe(true);
  });

  it("missing target → OT-CUS-003", () => {
    const result = validateThemeObject({
      ...base,
      customizationPoints: [{ id: "custom.x", type: "number", target: [] }],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CUS-003")).toBe(true);
  });
});

describe("validate a11y HC", () => {
  it("HC pair below 7:1 → OT-A11Y-002", () => {
    const result = validateThemeObject({
      ...base,
      contexts: [
        {
          when: { contrast: "high" },
          tokens: {
            color: {
              action: {
                primary: {
                  background: {
                    $value: {
                      colorSpace: "srgb",
                      components: [0.5, 0.5, 0.5],
                    },
                  },
                },
              },
              text: {
                "on-action": {
                  $value: {
                    colorSpace: "srgb",
                    components: [0.55, 0.55, 0.55],
                  },
                },
              },
            },
          },
        },
      ],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-A11Y-002")).toBe(true);
  });
});
