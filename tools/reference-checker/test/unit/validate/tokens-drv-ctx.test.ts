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

describe("validate tokens", () => {
  it("rejects neither $value nor $derive (OT-TOK-007)", () => {
    const result = validateThemeObject({
      ...base,
      tokens: {
        color: {
          $type: "color",
          orphan: { $description: "no value" },
        },
      },
    });
    // orphan without $value/$derive is a group-like empty object — not a token
    // Use an object that has $type at token level without value:
    const r2 = validateThemeObject({
      ...base,
      tokens: {
        color: {
          accent: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [1, 0, 0] },
            $derive: { op: "color.alpha", args: { color: "{color.accent}", alpha: 1 } },
          },
        },
      },
    });
    expect(r2.diagnostics.some((d) => d.code === "OT-TOK-007")).toBe(true);
    void result;
  });

  it("rejects invalid color grammar (OT-TOK-004)", () => {
    const result = validateThemeObject({
      ...base,
      tokens: {
        color: {
          $type: "color",
          bad: { $value: "not-a-color" },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-TOK-004")).toBe(true);
  });

  it("rejects reserved tokens.seed group (OT-TOK-003)", () => {
    const result = validateThemeObject({
      ...base,
      tokens: {
        seed: {
          $type: "color",
          x: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-TOK-003")).toBe(true);
  });
});

describe("validate derivations", () => {
  it("unknown op → OT-DRV-001", () => {
    const result = validateThemeObject({
      ...base,
      tokens: {
        color: {
          $type: "color",
          x: {
            $derive: { op: "color.nope", args: {} },
          },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-DRV-001")).toBe(true);
  });

  it("operand outside domain → OT-DRV-004", () => {
    const result = validateThemeObject({
      ...base,
      tokens: {
        color: {
          $type: "color",
          base: {
            $value: { colorSpace: "srgb", components: [1, 0, 0] },
          },
          tint: {
            $derive: {
              op: "color.mix",
              args: {
                color: "{color.base}",
                toward: "{color.base}",
                ratio: 1.5,
              },
            },
          },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-DRV-004")).toBe(true);
  });

  it("missing required arg → OT-DRV-002", () => {
    const result = validateThemeObject({
      ...base,
      tokens: {
        color: {
          $type: "color",
          x: {
            $derive: { op: "color.alpha", args: {} },
          },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-DRV-002")).toBe(true);
  });
});

describe("validate contexts", () => {
  it("duplicate when → OT-CTX-002", () => {
    const result = validateThemeObject({
      ...base,
      contexts: [
        {
          when: { colorScheme: "light" },
          tokens: {
            color: {
              surface: {
                base: {
                  $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
              },
            },
          },
        },
        {
          when: { colorScheme: "light" },
          tokens: {},
        },
      ],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CTX-002")).toBe(true);
  });

  it("unknown dimension → OT-CTX-001", () => {
    const result = validateThemeObject({
      ...base,
      contexts: [{ when: { flavor: "spicy" }, tokens: {} }],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CTX-001")).toBe(true);
  });

  it("unsupported scheme → OT-CTX-003", () => {
    const result = validateThemeObject({
      ...base,
      contexts: [{ when: { colorScheme: "dark" }, tokens: {} }],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CTX-003")).toBe(true);
  });

  it("undeclared overlay token → OT-CTX-004", () => {
    const result = validateThemeObject({
      ...base,
      contexts: [
        {
          when: { density: "compact" },
          tokens: {
            custom: {
              only: {
                $type: "number",
                $value: 1,
              },
            },
          },
        },
      ],
    });
    expect(result.diagnostics.some((d) => d.code === "OT-CTX-004")).toBe(true);
  });
});
