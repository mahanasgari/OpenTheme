import { describe, expect, it } from "vitest";
import { resolveTheme, type ResolveInput } from "../../../src/resolve/index.js";
import type { ThemeEntry } from "../../../src/resolve/select.js";
import {
  comparePrecedence,
  compareSelectionOrder,
} from "../../../src/versioning/semver.js";

const seeds = {
  light: {
    background: { colorSpace: "srgb", components: [0.98, 0.97, 0.95] },
    foreground: { colorSpace: "srgb", components: [0.12, 0.12, 0.14] },
    accent: { colorSpace: "oklch", components: [0.55, 0.15, 250] },
  },
  fontFamily: ["Inter", "system-ui", "sans-serif"],
};

function theme(version: string): Record<string, unknown> {
  return {
    opentheme: "1.0",
    id: "org.example.versioned",
    version,
    name: `V ${version}`,
    provenance: { origin: "prebuilt" },
    compatibility: { catalog: "1.0" },
    colorSchemes: { supported: ["light"], default: "light" },
    seeds,
  };
}

function resolveWith(versions: string[]): string {
  const input = {
    themes: versions.map((v) => ({ trust: "trusted", document: theme(v) })) as ThemeEntry[],
    selection: { id: "org.example.versioned" },
    previous: null,
    platform: {
      colorScheme: "light",
      contrast: "standard",
      forcedColors: false,
      reducedMotion: false,
      textScale: 1,
    },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    preferences: {},
    policy: { availableThemes: ["org.example.versioned", "org.opentheme.baseline"] },
  } as ResolveInput;
  return resolveTheme(input).resolved.applied.version;
}

describe("SemVer precedence (R-RES-005)", () => {
  it("orders core versions, pre-releases, and identifiers per SemVer 2.0.0 §11", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.2.0",
      "1.10.0",
      "2.0.0",
    ];
    for (let i = 0; i + 1 < ordered.length; i += 1) {
      expect(comparePrecedence(ordered[i]!, ordered[i + 1]!)).toBeLessThan(0);
      expect(comparePrecedence(ordered[i + 1]!, ordered[i]!)).toBeGreaterThan(0);
    }
  });

  it("ignores build metadata for precedence and breaks ties by version string", () => {
    expect(comparePrecedence("1.0.0+a", "1.0.0+b")).toBe(0);
    expect(compareSelectionOrder("1.0.0+b", "1.0.0+a")).toBeGreaterThan(0);
  });
});

describe("unversioned selection (R-RES-005)", () => {
  it("applies the highest precedence regardless of entry order", () => {
    const versions = ["1.0.0", "1.10.0", "1.2.0", "1.10.0-rc.1"];
    expect(resolveWith(versions)).toBe("1.10.0");
    expect(resolveWith([...versions].reverse())).toBe("1.10.0");
  });

  it("prefers a release over its own pre-release, but a newer pre-release over an older release", () => {
    expect(resolveWith(["1.3.0", "1.3.0-beta.1"])).toBe("1.3.0");
    expect(resolveWith(["1.2.0", "1.3.0-beta.1"])).toBe("1.3.0-beta.1");
  });
});
