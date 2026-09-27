/**
 * Unit tests for normalize + integrity (R3).
 */
import { describe, expect, it } from "vitest";
import { normalizeTheme } from "../../../src/canonical/normalize.js";
import { computeIntegrity } from "../../../src/canonical/integrity.js";

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
      background: {
        colorSpace: "srgb",
        components: [0.98, 0.97, 0.95],
        alpha: 1,
        hex: "#FAF8F2",
      },
      foreground: {
        colorSpace: "srgb",
        components: [0.12, 0.12, 0.14],
      },
      accent: {
        colorSpace: "oklch",
        components: [0.55, 0.15, 250],
      },
    },
    fontFamily: ["system-ui", "sans-serif"],
  },
  $extensions: { "com.example.tool": { state: 1 } },
  integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};

describe("normalizeTheme", () => {
  it("strips integrity, alpha:1, and hex when components present", () => {
    const n = normalizeTheme(base) as Record<string, unknown>;
    expect(n.integrity).toBeUndefined();
    const bg = (n.seeds as { light: { background: Record<string, unknown> } })
      .light.background;
    expect(bg.alpha).toBeUndefined();
    expect(bg.hex).toBeUndefined();
    expect(bg.components).toEqual([0.98, 0.97, 0.95]);
  });

  it("preserves $extensions", () => {
    const n = normalizeTheme(base) as Record<string, unknown>;
    expect(n.$extensions).toEqual({ "com.example.tool": { state: 1 } });
  });

  it("converts hex-only colors to components", () => {
    const doc = {
      color: { hex: "#FF0000" },
    };
    const n = normalizeTheme(doc) as { color: Record<string, unknown> };
    expect(n.color.hex).toBeUndefined();
    expect(n.color.colorSpace).toBe("srgb");
    expect(n.color.components).toEqual([1, 0, 0]);
  });
});

describe("computeIntegrity", () => {
  it("is stable across member order", () => {
    const a = computeIntegrity(base);
    const reordered = {
      integrity: base.integrity,
      name: base.name,
      seeds: base.seeds,
      $extensions: base.$extensions,
      colorSchemes: base.colorSchemes,
      compatibility: base.compatibility,
      provenance: base.provenance,
      version: base.version,
      id: base.id,
      opentheme: base.opentheme,
    };
    const b = computeIntegrity(reordered);
    expect(a.integrity).toBe(b.integrity);
    expect(a.canonical).toBe(b.canonical);
    expect(a.integrity).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
  });

  it("round-trips: re-parse then canonicalize is identical", () => {
    const first = computeIntegrity(base);
    const second = computeIntegrity(
      JSON.parse(first.canonical) as Record<string, unknown>,
    );
    expect(second.canonical).toBe(first.canonical);
    expect(second.integrity).toBe(first.integrity);
  });
});
