import { describe, expect, it } from "vitest";
import {
  resolveTheme,
  resolvedToJcs,
  loadSpecificationBaseline,
} from "../../../src/resolve/index.js";
import { validateThemeObject } from "../../../src/validate/document.js";

const quietPaper = {
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

function baseInput(theme: Record<string, unknown>, contrast: "standard" | "high" = "standard") {
  return {
    theme,
    selection: { id: String(theme.id) },
    previous: null,
    platform: {
      colorScheme: "light" as const,
      contrast,
      forcedColors: false,
      reducedMotion: false,
      textScale: 1,
    },
    environment: {
      sizeClass: "expanded" as const,
      locale: "en",
      direction: "ltr" as const,
    },
    preferences: {},
    policy: {
      availableThemes: [String(theme.id), "org.opentheme.baseline"],
      defaultTheme: "org.opentheme.baseline",
    },
  };
}

describe("resolve core", () => {
  it("specification baseline validates", () => {
    const baseline = loadSpecificationBaseline();
    const result = validateThemeObject(baseline);
    expect(result.valid).toBe(true);
  });

  it("seed-only theme resolves completely", () => {
    const { resolved } = resolveTheme(baseInput(quietPaper));
    expect(resolved.applied.fallback).toBe("none");
    expect(resolved.applied.id).toBe(quietPaper.id);
    expect(resolved.context.colorScheme).toBe("light");
    expect(resolved.context.contrast).toBe("standard");

    // Seeds present
    expect(resolved.tokens["seed.background"]).toBeDefined();
    expect(resolved.tokens["seed.foreground"]).toBeDefined();
    expect(resolved.tokens["seed.accent"]).toBeDefined();

    // Baseline semantic tokens present (no aliases left as strings)
    expect(resolved.tokens["color.surface.base"]).toBeDefined();
    expect(resolved.tokens["color.text.primary"]).toBeDefined();
    expect(resolved.tokens["color.action.primary.background"]).toBeDefined();

    const color = resolved.tokens["color.surface.base"] as {
      srgb8?: number[];
    };
    expect(color.srgb8).toBeDefined();
    expect(Array.isArray(color.srgb8)).toBe(true);

    // Catalog contracts styled
    expect(resolved.components["std/button"]).toBeDefined();
    expect(resolved.accessibility.complete).toBe(true);

    // No raw alias/derive left in token values
    for (const v of Object.values(resolved.tokens)) {
      expect(typeof v === "string" && (v as string).startsWith("{")).toBe(false);
      if (v && typeof v === "object" && "$derive" in (v as object)) {
        expect.fail("derivation left unresolved");
      }
    }
  });

  it("high-contrast uses HC sourcing (not standard-contrast colors from overlays)", () => {
    const theme = {
      ...quietPaper,
      colorSchemes: { supported: ["light"], default: "light" },
      contexts: [
        {
          when: { colorScheme: "light" },
          tokens: {
            color: {
              action: {
                primary: {
                  background: {
                    $value: {
                      colorSpace: "srgb",
                      components: [0.8, 0.2, 0.2],
                    },
                  },
                },
              },
            },
          },
        },
        {
          when: { contrast: "high" },
          tokens: {
            color: {
              action: {
                primary: {
                  background: {
                    $value: {
                      colorSpace: "srgb",
                      components: [1, 1, 1],
                    },
                  },
                },
              },
              text: {
                "on-action": {
                  $value: {
                    colorSpace: "srgb",
                    components: [0, 0, 0],
                  },
                },
              },
            },
          },
        },
      ],
    };

    const { resolved } = resolveTheme(baseInput(theme, "high"));
    expect(resolved.context.contrast).toBe("high");
    const bg = resolved.tokens["color.action.primary.background"] as {
      srgb8: number[];
    };
    // Author HC white, not the standard-contrast red overlay
    expect(bg.srgb8[0]).toBeGreaterThan(250);
    expect(bg.srgb8[1]).toBeGreaterThan(250);
    expect(bg.srgb8[2]).toBeGreaterThan(250);

    const onAction = resolved.tokens["color.text.on-action"] as {
      srgb8: number[];
    };
    expect(onAction.srgb8[0]).toBeLessThan(5);
  });

  it("falls back to specification baseline when selection missing", () => {
    const { resolved, diagnostics } = resolveTheme({
      ...baseInput(quietPaper),
      selection: { id: "org.missing.theme" },
      themes: [],
      theme: undefined,
      policy: {
        availableThemes: ["org.opentheme.baseline"],
        // No developer default → chain reaches specification baseline (OT-RES-003)
      },
    });
    expect(resolved.applied.fallback).toBe("specification-baseline");
    expect(resolved.applied.id).toBe("org.opentheme.baseline");
    expect(diagnostics.some((d) => d.code === "OT-RES-003")).toBe(true);
  });

  it("identical inputs produce identical JCS bytes", () => {
    const input = baseInput(quietPaper);
    const a = resolveTheme(input).resolved;
    const b = resolveTheme(input).resolved;
    expect(resolvedToJcs(a)).toBe(resolvedToJcs(b));
  });
});
