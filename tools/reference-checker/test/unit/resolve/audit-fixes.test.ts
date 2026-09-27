import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../../src/diagnostics/collector.js";
import { analyzeTokenGraph } from "../../../src/tokens/graph.js";
import { validateThemeObject } from "../../../src/validate/document.js";
import { isProtectedPath } from "../../../src/resolve/preferences.js";
import {
  clearAccessibilityPairCache,
  checkAccessibility,
  loadAccessibilityPairs,
} from "../../../src/resolve/check.js";
import { kahnOrder } from "../../../src/resolve/evaluate.js";
import type { Declaration } from "../../../src/resolve/declare.js";
import { resolveTheme } from "../../../src/resolve/index.js";

const quietSeeds = {
  light: {
    background: { colorSpace: "srgb", components: [0.98, 0.97, 0.95] },
    foreground: { colorSpace: "srgb", components: [0.12, 0.12, 0.14] },
    accent: { colorSpace: "oklch", components: [0.55, 0.15, 250] },
  },
  fontFamily: ["Inter", "system-ui", "sans-serif"],
};

describe("audit fixes B1–H6", () => {
  it("B1: rejects $script / $eval / $foo under token leaves", () => {
    for (const key of ["$script", "$eval", "$foo"]) {
      const result = validateThemeObject({
        opentheme: "1.0",
        id: "uid.abcdefghijklmnopqrstuv2345",
        version: "1.0.0",
        name: "T",
        provenance: { origin: "user-created" },
        compatibility: { catalog: "1.0" },
        colorSchemes: { supported: ["light"], default: "light" },
        seeds: quietSeeds,
        tokens: {
          color: {
            x: {
              $type: "color",
              $value: { colorSpace: "srgb", components: [0, 0, 0] },
              [key]: true,
            },
          },
        },
      });
      expect(result.valid).toBe(false);
      expect(
        result.diagnostics.some(
          (d) => d.code === "OT-DOC-003" && d.location.pointer.includes(key),
        ),
      ).toBe(true);
    }
  });

  it("B2: seed and host-qualified refs resolve; missing do not", () => {
    const ok = validateThemeObject({
      opentheme: "1.0",
      id: "uid.abcdefghijklmnopqrstuv2345",
      version: "1.0.0",
      name: "T",
      provenance: { origin: "user-created" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: quietSeeds,
      tokens: {
        color: { $type: "color", brand: { $value: "{seed.accent}" } },
      },
    });
    expect(ok.diagnostics.some((d) => d.code === "OT-REF-001")).toBe(false);

    const hostOk = validateThemeObject(
      {
        opentheme: "1.0",
        id: "uid.abcdefghijklmnopqrstuv2345",
        version: "1.0.0",
        name: "T",
        provenance: { origin: "user-created" },
        compatibility: { catalog: "1.0" },
        colorSchemes: { supported: ["light"], default: "light" },
        seeds: quietSeeds,
        tokens: {
          color: {
            $type: "color",
            echo: { $value: "{com.example.notes/color.rail}" },
          },
        },
      },
      {
        host: {
          id: "com.example.notes",
          tokens: {
            color: {
              $type: "color",
              rail: {
                $value: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
              },
            },
          },
        },
      },
    );
    expect(hostOk.diagnostics.some((d) => d.code === "OT-REF-001")).toBe(false);

    const dangling = validateThemeObject({
      opentheme: "1.0",
      id: "uid.abcdefghijklmnopqrstuv2345",
      version: "1.0.0",
      name: "T",
      provenance: { origin: "user-created" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: quietSeeds,
      tokens: {
        color: { $type: "color", brand: { $value: "{seed.nope}" } },
      },
    });
    expect(dangling.diagnostics.some((d) => d.code === "OT-REF-001")).toBe(true);
  });

  it("B3: protected matching is prefix/path, not exact-only", () => {
    const prefixes = ["color.status.danger", "color.status.warning"];
    expect(isProtectedPath("color.status.danger", prefixes)).toBe(true);
    expect(isProtectedPath("color.status.danger.background", prefixes)).toBe(
      true,
    );
    expect(isProtectedPath("color.status.danger.foreground", prefixes)).toBe(
      true,
    );
    expect(isProtectedPath("color.status.info.background", prefixes)).toBe(
      false,
    );
    expect(isProtectedPath("color.surface.base", prefixes)).toBe(false);
  });

  it("B4: high contrast does not apply base theme color declarations", () => {
    const theme = {
      opentheme: "1.0",
      id: "org.example.hc-iso",
      version: "1.0.0",
      name: "HC",
      provenance: { origin: "user-created" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: quietSeeds,
      tokens: {
        color: {
          action: {
            primary: {
              background: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0.9, 0.1, 0.1] },
              },
            },
          },
        },
      },
      contexts: [
        {
          when: { contrast: "high" },
          tokens: {
            color: {
              action: {
                primary: {
                  background: {
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                  },
                },
              },
            },
          },
        },
      ],
    };
    const { resolved } = resolveTheme({
      theme,
      selection: { id: theme.id },
      previous: null,
      platform: {
        colorScheme: "light",
        contrast: "high",
        forcedColors: false,
        reducedMotion: false,
        textScale: 1,
      },
      environment: { sizeClass: "expanded", locale: "en", direction: "ltr" },
      preferences: {},
      policy: {
        availableThemes: [theme.id, "org.opentheme.baseline"],
      },
    });
    const bg = resolved.tokens["color.action.primary.background"] as {
      srgb8: number[];
    };
    expect(bg.srgb8[0]).toBeGreaterThan(250);
    expect(bg.srgb8[1]).toBeGreaterThan(250);
    expect(bg.srgb8[2]).toBeGreaterThan(250);
  });

  it("H1+H2: accessibility pairs come from the registry", () => {
    clearAccessibilityPairCache();
    const pairs = loadAccessibilityPairs();
    expect(pairs.length).toBeGreaterThan(4);
    expect(
      pairs.some(
        (p) =>
          p.foreground === "color.text.primary" &&
          p.background === "color.surface.base",
      ),
    ).toBe(true);
    expect(
      pairs.some(
        (p) =>
          p.foreground === "color.link" &&
          p.background === "color.surface.base",
      ),
    ).toBe(true);

    // Prove registry drives validation: a synthetic pair list is honored.
    const tokens = new Map([
      [
        "color.text.primary",
        { srgb8: [0, 0, 0] as [number, number, number], alpha: 1 },
      ],
      [
        "color.surface.base",
        { srgb8: [255, 255, 255] as [number, number, number], alpha: 1 },
      ],
      [
        "seed.foreground",
        { srgb8: [0, 0, 0] as [number, number, number], alpha: 1 },
      ],
      [
        "seed.background",
        { srgb8: [255, 255, 255] as [number, number, number], alpha: 1 },
      ],
    ]);
    const report = checkAccessibility(
      tokens,
      {
        colorScheme: "light",
        seedScheme: "light",
        contrast: "standard",
        motion: "standard",
        density: "standard",
        sizeClass: "expanded",
        textScale: 1,
        forcedColors: false,
        direction: "ltr",
        locale: "en",
      },
      [
        {
          foreground: "color.text.primary",
          background: "color.surface.base",
          kind: "text",
        },
      ],
    );
    expect(report.pairs).toHaveLength(2); // seed + injected
    expect(report.pairs.every((p) => p.pass)).toBe(true);

    const narrow = checkAccessibility(
      tokens,
      {
        colorScheme: "light",
        seedScheme: "light",
        contrast: "standard",
        motion: "standard",
        density: "standard",
        sizeClass: "expanded",
        textScale: 1,
        forcedColors: false,
        direction: "ltr",
        locale: "en",
      },
      [],
    );
    expect(narrow.pairs).toHaveLength(1); // seed only when registry empty
  });

  it("H3: evaluation uses Kahn order with lex ties", () => {
    const decls = new Map<string, Declaration>([
      [
        "color.b",
        {
          path: "color.b",
          type: "color",
          value: "{color.a}",
          source: "theme",
        },
      ],
      [
        "color.a",
        {
          path: "color.a",
          type: "color",
          value: { colorSpace: "srgb", components: [1, 1, 1] },
          source: "theme",
        },
      ],
      [
        "color.c",
        {
          path: "color.c",
          type: "color",
          value: "{color.a}",
          source: "theme",
        },
      ],
    ]);
    const order = kahnOrder(decls);
    expect(order.indexOf("color.a")).toBeLessThan(order.indexOf("color.b"));
    expect(order.indexOf("color.a")).toBeLessThan(order.indexOf("color.c"));
    // Tie among dependents of a: lex order b before c
    expect(order.indexOf("color.b")).toBeLessThan(order.indexOf("color.c"));
  });

  it("H4: applied.trust reflects chain minimum (FR-048)", () => {
    const base = {
      opentheme: "1.0",
      id: "org.example.untrusted-base",
      version: "1.0.0",
      name: "Base",
      provenance: { origin: "imported" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: quietSeeds,
    };
    const child = {
      ...base,
      id: "org.example.trusted-child",
      name: "Child",
      provenance: { origin: "user-created" },
      extends: { id: "org.example.untrusted-base", version: "^1.0.0" },
    };
    const { resolved } = resolveTheme({
      themes: [
        { trust: "untrusted", document: base },
        { trust: "trusted", document: child },
      ],
      selection: { id: child.id },
      previous: null,
      platform: {
        colorScheme: "light",
        contrast: "standard",
        forcedColors: false,
        reducedMotion: false,
        textScale: 1,
      },
      environment: { sizeClass: "expanded", locale: "en", direction: "ltr" },
      preferences: {},
      policy: {
        availableThemes: [child.id, base.id, "org.opentheme.baseline"],
      },
    });
    expect(resolved.applied.trust).toBe("untrusted");
  });

  it("H5: SEC-002 integrity collision is fail-closed (no silent pick)", () => {
    const a = {
      opentheme: "1.0",
      id: "uid.maliciousduplicate00002",
      version: "1.0.0",
      name: "A",
      provenance: { origin: "user-created" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: quietSeeds,
    };
    const b = {
      ...a,
      name: "B",
      seeds: {
        light: {
          background: { colorSpace: "srgb", components: [0.01, 0.01, 0.01] },
          foreground: { colorSpace: "srgb", components: [0.99, 0.99, 0.99] },
          accent: { colorSpace: "srgb", components: [1, 0, 0] },
        },
        fontFamily: ["fantasy"],
      },
    };
    const { resolved, diagnostics } = resolveTheme({
      themes: [
        { trust: "trusted", document: a },
        { trust: "trusted", document: b },
      ],
      selection: { id: a.id, version: "1.0.0" },
      previous: null,
      platform: {
        colorScheme: "light",
        contrast: "standard",
        forcedColors: false,
        reducedMotion: false,
        textScale: 1,
      },
      environment: { sizeClass: "expanded", locale: "en", direction: "ltr" },
      preferences: {},
      policy: {
        availableThemes: [a.id, "org.opentheme.baseline"],
        defaultTheme: "org.opentheme.baseline",
      },
    });
    expect(diagnostics.some((d) => d.code === "OT-SEC-002")).toBe(true);
    expect(resolved.applied.id).toBe("org.opentheme.baseline");
    expect(resolved.applied.fallback).not.toBe("none");
  });

  it("H6: post-process runs before quantize (forced colors are system, not srgb8)", () => {
    const theme = {
      opentheme: "1.0",
      id: "uid.abcdefghijklmnopqrstuv2345",
      version: "1.0.0",
      name: "Quiet Paper",
      provenance: { origin: "user-created" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: quietSeeds,
    };
    const { resolved } = resolveTheme({
      theme,
      selection: { id: theme.id },
      previous: null,
      platform: {
        colorScheme: "light",
        contrast: "standard",
        forcedColors: true,
        reducedMotion: false,
        textScale: 1,
      },
      environment: { sizeClass: "expanded", locale: "en", direction: "ltr" },
      preferences: {},
      policy: {
        availableThemes: [theme.id, "org.opentheme.baseline"],
      },
    });
    const surface = resolved.tokens["color.surface.base"] as {
      system?: string;
      srgb8?: number[];
    };
    expect(surface.system).toBeDefined();
    expect(surface.srgb8).toBeUndefined();
  });
});
