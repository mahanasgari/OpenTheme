import { describe, expect, it } from "vitest";
import { validateThemeDocument } from "../../../src/schema/validate.js";

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

describe("validateThemeDocument", () => {
  it("accepts the minimal seed-only theme", () => {
    const result = validateThemeDocument(minimal);
    expect(result.valid).toBe(true);
  });

  it("maps unknown members to OT-DOC-003", () => {
    const result = validateThemeDocument({ ...minimal, unexpected: true });
    expect(result.valid).toBe(false);
    const diag = result.diagnostics.find(
      (d) => d.code === "OT-DOC-003" && d.location.pointer.includes("unexpected"),
    );
    expect(diag).toBeDefined();
  });

  it("maps missing required members to OT-DOC-005", () => {
    const { name: _removed, ...rest } = minimal;
    const result = validateThemeDocument(rest);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "OT-DOC-005")).toBe(true);
  });

  it("maps wrong types to OT-DOC-004 or META type codes", () => {
    const result = validateThemeDocument({ ...minimal, version: 1 });
    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.some(
        (d) => d.code === "OT-DOC-004" || d.code === "OT-META-003",
      ),
    ).toBe(true);
  });
});
