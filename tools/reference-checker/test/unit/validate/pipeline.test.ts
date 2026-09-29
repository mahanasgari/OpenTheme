import { describe, expect, it } from "vitest";
import { validateThemeObject } from "../../../src/validate/document.js";

const minimal = {
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

describe("validate pipeline", () => {
  it("accepts the contracts/theme-document.md minimal theme", () => {
    const result = validateThemeObject(minimal);
    expect(result.valid).toBe(true);
  });

  it("metadata-only theme (no seed colors) → OT-TOK-010", () => {
    const result = validateThemeObject({
      ...minimal,
      seeds: { fontFamily: ["Inter", "sans-serif"] },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-TOK-010")).toBe(true);
  });

  it('opentheme "1.1" → OT-VER-002 with version param', () => {
    const result = validateThemeObject({ ...minimal, opentheme: "1.1" });
    const d = result.diagnostics.find((x) => x.code === "OT-VER-002");
    expect(d).toBeDefined();
    expect(d?.params.version).toBe("1.1");
  });

  it('opentheme "2.0" → OT-VER-001', () => {
    const result = validateThemeObject({ ...minimal, opentheme: "2.0" });
    expect(result.diagnostics.some((d) => d.code === "OT-VER-001")).toBe(true);
  });

  it("dark declared with seeds for light only → OT-TOK-010", () => {
    const result = validateThemeObject({
      ...minimal,
      colorSchemes: { supported: ["light", "dark"], default: "light" },
    });
    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "OT-TOK-010" &&
          d.location.pointer.includes("dark"),
      ),
    ).toBe(true);
  });

  it("translucent seed → OT-TOK-011", () => {
    const result = validateThemeObject({
      ...minimal,
      seeds: {
        ...minimal.seeds,
        light: {
          ...minimal.seeds.light,
          accent: {
            colorSpace: "srgb",
            components: [0.2, 0.4, 0.8],
            alpha: 0.5,
          },
        },
      },
    });
    expect(result.diagnostics.some((d) => d.code === "OT-TOK-011")).toBe(true);
  });

  it("seed pair below 4.5:1 → OT-A11Y-001 with both pointers", () => {
    const result = validateThemeObject({
      ...minimal,
      seeds: {
        ...minimal.seeds,
        light: {
          background: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
          foreground: { colorSpace: "srgb", components: [0.55, 0.55, 0.55] },
          accent: { colorSpace: "srgb", components: [0.2, 0.4, 0.8] },
        },
      },
    });
    const d = result.diagnostics.find((x) => x.code === "OT-A11Y-001");
    expect(d).toBeDefined();
    expect(d?.related?.length).toBe(2);
  });

  it("alpha 0 on the focus role color.focus → OT-A11Y-005 (chapter 11)", () => {
    const clear = { colorSpace: "srgb", components: [0.2, 0.4, 0.9], alpha: 0 };
    const focus = validateThemeObject({ ...minimal, tokens: { color: { focus: { $value: clear } } } });
    expect(focus.diagnostics.some((d) => d.code === "OT-A11Y-005")).toBe(true);
    // Only the focus role is a focus indicator; a token merely named "focus…" is not.
    const other = validateThemeObject({
      ...minimal,
      tokens: { color: { $type: "color", "focus-glow": { $value: clear } } },
    });
    expect(other.diagnostics.some((d) => d.code === "OT-A11Y-005")).toBe(false);
  });

  it("reports multiple independent errors in one pass", () => {
    const result = validateThemeObject({
      ...minimal,
      colorSchemes: { supported: ["light", "dark"], default: "light" },
      seeds: {
        light: {
          background: {
            colorSpace: "srgb",
            components: [0.5, 0.5, 0.5],
            alpha: 0.9,
          },
          foreground: { colorSpace: "srgb", components: [0.55, 0.55, 0.55] },
        },
        fontFamily: ["Inter", "sans-serif"],
      },
    });
    const codes = new Set(result.diagnostics.map((d) => d.code));
    expect(codes.has("OT-TOK-010")).toBe(true);
    expect(codes.has("OT-TOK-011")).toBe(true);
    expect(codes.has("OT-A11Y-001")).toBe(true);
  });
});
