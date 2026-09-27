/** Chapter 12 identity rules over the registry (FR-C031, FR-C023; OT-SEC-001, OT-SEC-002). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { AURORA, GRAPHITE, LIGHT_CONTEXT, read } from "../../helpers.js";

const edited = (path: string, edit: (d: Record<string, unknown>) => void): string => {
  const doc = JSON.parse(read(path)) as Record<string, unknown>;
  delete doc.integrity;
  edit(doc);
  return JSON.stringify(doc);
};

const resolveId = (core: ReturnType<typeof createCore>, id: string, available: string[]) =>
  core.resolve(core.registry.snapshot(), {
    policy: { availableThemes: available, defaultTheme: "org.opentheme.baseline" },
    selection: { id },
    previous: null,
    preferences: {},
    ...LIGHT_CONTEXT,
  });

describe("identity", () => {
  it("never lets an untrusted impostor replace the built-in baseline", () => {
    const core = createCore({ untrustedSources: { shared: true } });
    const impostor = edited(AURORA, (d) => {
      d.id = "org.opentheme.baseline";
    });
    core.registry.admit({ kind: "theme", bytes: impostor, trust: "untrusted", source: "shared" });
    const r = resolveId(core, "org.opentheme.baseline", ["org.opentheme.baseline"]);
    expect(r.ok && r.resolved.applied).toMatchObject({ id: "org.opentheme.baseline", trust: "trusted" });
    expect(r.ok && JSON.stringify(r.resolved.displayText)).not.toContain("Aurora");
  });

  it("resolves a trusted child against its trusted base, whatever an untrusted base impostor does", () => {
    for (const impostorFirst of [true, false]) {
      const core = createCore({ untrustedSources: { shared: true } });
      const child = edited(AURORA, (d) => {
        d.id = "com.example.child";
        d.extends = { id: "org.opentheme.graphite", version: "^1.0.0" };
      });
      const impostor = edited(GRAPHITE, (d) => {
        d.name = "Graphite (impostor)";
      });
      const steps = [
        () => core.registry.admit({ kind: "theme", bytes: impostor, trust: "untrusted", source: "shared" }),
        () => core.registry.admit({ kind: "theme", bytes: read(GRAPHITE), trust: "trusted" }),
      ];
      (impostorFirst ? steps : [...steps].reverse()).forEach((s) => s());
      expect(core.registry.admit({ kind: "theme", bytes: child, trust: "trusted" }).status).toBe("registered");
      const r = resolveId(core, "com.example.child", ["com.example.child"]);
      expect(r.ok && r.resolved.applied).toMatchObject({ id: "com.example.child", trust: "trusted", fallback: "none" });
    }
  });

  it("keeps same-version documents with different integrity distinct and reports the conflict", () => {
    const core = createCore();
    core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
    core.registry.admit({ kind: "theme", bytes: edited(AURORA, (d) => (d.name = "Aurora II")), trust: "trusted" });
    expect(core.registry.snapshot().entries).toHaveLength(2);
    const r = resolveId(core, "org.opentheme.aurora", ["org.opentheme.aurora"]);
    expect(r.ok && r.diagnostics.map((d) => d.code)).toContain("OT-SEC-002");
  });
});
