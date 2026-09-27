/** Policy presets compile to the abstract policy (FR-C065; research CR14). */
import { describe, expect, it } from "vitest";
import { createCore, PRESETS } from "../../../src/index.js";
import { compilePolicy } from "../../../src/resolve/presets.js";
import { AURORA, GRAPHITE, read } from "../../helpers.js";

const STANDARD = ["std.accent", "std.color-scheme", "std.contrast", "std.text-size", "std.density", "std.corner-roundness", "std.motion"];

describe("presets", () => {
  const core = createCore({ untrustedSources: { shared: true } });
  core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
  const copy = JSON.parse(read(GRAPHITE)) as Record<string, unknown>;
  copy.id = "com.example.shared";
  core.registry.admit({ kind: "theme", bytes: JSON.stringify(copy), trust: "untrusted", source: "shared" });
  const snapshot = core.registry.snapshot();

  it("closed: trusted registered themes, no points, light and dark, AA floor", () => {
    expect(compilePolicy({ preset: "closed", defaultTheme: "org.opentheme.aurora" }, snapshot, "t")).toEqual({
      availableThemes: ["org.opentheme.aurora", "org.opentheme.baseline"],
      defaultTheme: "org.opentheme.aurora",
      permittedPoints: {},
      allowedColorSchemes: ["light", "dark"],
      accessibilityFloor: "wcag22-aa",
    });
  });

  it("common-personalization: the same plus the seven standard points, unnarrowed", () => {
    const p = compilePolicy({ preset: "common-personalization", defaultTheme: "org.opentheme.aurora" }, snapshot, "t");
    expect(Object.keys(p.permittedPoints ?? {}).sort()).toEqual([...STANDARD].sort());
    for (const v of Object.values(p.permittedPoints ?? {})) expect(v).toEqual({});
    expect(p.accessibilityFloor).toBe("wcag22-aa");
    expect(p.availableThemes).not.toContain("com.example.shared");
  });

  it("are frozen and reject unknown names and members", () => {
    expect(Object.isFrozen(PRESETS.closed)).toBe(true);
    expect(() => compilePolicy({ preset: "open" as never, defaultTheme: "x" }, snapshot, "t")).toThrow(/unknown-preset/);
    expect(() => compilePolicy({ preset: "closed", defaultTheme: "x", locks: {} } as never, snapshot, "t")).toThrow(/invalid-argument/);
  });
});
