/** Admission, trust, sources, gates, and registry identity (quickstart scenario 2; US2). */
import { describe, expect, it } from "vitest";
import { createCore, type Core } from "../../../src/index.js";
import { AURORA, GRAPHITE, LIGHT_CONTEXT, read } from "../../helpers.js";

const malicious = JSON.stringify(
  (JSON.parse(read("conformance/fixtures/malicious/content/bidi-override.json")) as { input: { theme: unknown } }).input.theme,
);

/** Aurora under a new id, with a dark-mode secondary text color far below 4.5:1. */
function dimTheme(): string {
  const doc = JSON.parse(read(AURORA)) as Record<string, unknown> & { contexts?: unknown[] };
  doc.id = "com.example.dim";
  delete doc.integrity;
  doc.contexts = [
    ...(doc.contexts ?? []),
    {
      when: { colorScheme: "dark" },
      tokens: { color: { text: { secondary: { $value: { colorSpace: "srgb", components: [0.2, 0.2, 0.2] } } } } },
    },
  ];
  return JSON.stringify(doc);
}

function impostor(): string {
  const doc = JSON.parse(read(AURORA)) as Record<string, unknown>;
  doc.name = "Aurora (impostor)";
  delete doc.integrity;
  return JSON.stringify(doc);
}

const request = (id: string, core: Core, available: string[]) => ({
  policy: { availableThemes: available, defaultTheme: "org.opentheme.baseline" },
  selection: { id },
  previous: null,
  preferences: {},
  ...LIGHT_CONTEXT,
});

describe("trust and sources", () => {
  it("refuses an admission without trust, before parsing", () => {
    const core = createCore();
    const r = core.registry.admit({ kind: "theme", bytes: "not json", trust: undefined as never });
    expect(r.status).toBe("refused");
    expect(r.error?.kind).toBe("trust-missing");
    expect(r.diagnostics).toEqual([]);
  });

  it("refuses untrusted admissions from disabled, missing, or unknown sources", () => {
    const core = createCore();
    const kinds = [
      core.registry.admit({ kind: "theme", bytes: malicious, trust: "untrusted", source: "imported" }),
      core.registry.admit({ kind: "theme", bytes: malicious, trust: "untrusted" }),
      core.registry.admit({ kind: "theme", bytes: malicious, trust: "untrusted", source: "web" as never }),
    ].map((r) => [r.status, r.error?.kind, r.diagnostics.length]);
    expect(kinds).toEqual([
      ["refused", "source-not-allowed", 0],
      ["refused", "source-missing", 0],
      ["refused", "source-unknown", 0],
    ]);
  });

  it("registers an invalid untrusted document for reporting but never lists it", () => {
    const core = createCore({ untrustedSources: { imported: true } });
    const r = core.registry.admit({ kind: "theme", bytes: malicious, trust: "untrusted", source: "imported" });
    expect(r.status).toBe("invalid");
    expect(r.diagnostics.map((d) => d.code)).toContain("OT-META-004");
    const listed = core.listSelectable(core.registry.snapshot(), { availableThemes: [r.entry!.id] }, "en");
    expect(listed).toEqual([]);
  });

  it("keeps the trusted document selected against an untrusted impostor, in either order", () => {
    for (const order of [0, 1]) {
      const core = createCore({ untrustedSources: { shared: true } });
      const admit = [
        () => core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" }),
        () => core.registry.admit({ kind: "theme", bytes: impostor(), trust: "untrusted", source: "shared" }),
      ];
      (order === 0 ? admit : [...admit].reverse()).forEach((f) => f());
      const snapshot = core.registry.snapshot();
      const listed = core.listSelectable(snapshot, { availableThemes: ["org.opentheme.aurora"] }, "en");
      expect(listed.map((t) => [t.id, t.trust, t.name])).toEqual([["org.opentheme.aurora", "trusted", "Aurora"]]);
      const result = core.resolve(snapshot, request("org.opentheme.aurora", core, ["org.opentheme.aurora"]));
      expect(result.ok && (result.resolved.applied as { trust: string }).trust).toBe("trusted");
      expect(result.ok && result.diagnostics.map((d) => d.code)).toContain("OT-SEC-001");
    }
  });
});

describe("accessibility gate", () => {
  it("refuses an untrusted theme with an AA shortfall and returns the OT-A11Y-003 diagnostics", () => {
    const core = createCore({ untrustedSources: { "user-created": true } });
    const r = core.registry.admit({ kind: "theme", bytes: dimTheme(), trust: "untrusted", source: "user-created" });
    expect(r.status).toBe("refused");
    expect(r.error?.kind).toBe("accessibility-gate");
    expect(r.diagnostics.some((d) => d.code === "OT-A11Y-003")).toBe(true);
    expect(core.registry.snapshot().entries).toEqual([]);
  });

  it("reports but never refuses the same bytes when trusted, or when the gate is relaxed", () => {
    const trusted = createCore().registry.admit({ kind: "theme", bytes: dimTheme(), trust: "trusted" });
    expect(trusted.status).toBe("registered");
    expect(trusted.diagnostics.some((d) => d.code === "OT-A11Y-003")).toBe(true);
    const relaxed = createCore({ untrustedSources: { "user-created": true }, accessibilityGate: "relaxed" }).registry.admit({
      kind: "theme",
      bytes: dimTheme(),
      trust: "untrusted",
      source: "user-created",
    });
    expect(relaxed.status).toBe("registered");
    expect(relaxed.entry?.gate).toBe("pass");
    expect(relaxed.diagnostics.some((d) => d.code === "OT-A11Y-003")).toBe(true);
  });

  it("stops listing untrusted entries once their source is turned off (FR-C027)", () => {
    const core = createCore({ untrustedSources: { imported: true } });
    const doc = JSON.parse(read(GRAPHITE)) as Record<string, unknown>;
    doc.id = "com.example.graphite-copy";
    delete doc.integrity;
    const r = core.registry.admit({ kind: "theme", bytes: JSON.stringify(doc), trust: "untrusted", source: "imported" });
    expect(r.status).toBe("registered");
    const policy = { availableThemes: ["com.example.graphite-copy"], defaultTheme: "org.opentheme.baseline" };
    const before = core.registry.snapshot();
    expect(core.listSelectable(before, policy, "en")).toHaveLength(1);
    core.updateSettings({ untrustedSources: { imported: false } });
    const after = core.registry.snapshot();
    expect(after.sequence).toBeGreaterThan(before.sequence);
    expect(after.entries[0]?.gate).toBe("refused-source");
    expect(core.listSelectable(after, policy, "en")).toEqual([]);
    const result = core.resolve(after, { ...request("com.example.graphite-copy", core, policy.availableThemes), policy });
    expect(result.ok && result.outcome).toBe("fallback");
    // The earlier snapshot is unchanged (FR-C032).
    expect(core.listSelectable(before, policy, "en")).toHaveLength(1);
  });
});

describe("registry identity and capacity", () => {
  it("returns already-registered for identical bytes and refuses beyond capacity without evicting", () => {
    const core = createCore({ registryCapacity: 1 });
    const first = core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
    expect(first.status).toBe("registered");
    const again = core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
    expect(again.status).toBe("already-registered");
    expect(again.entry).toEqual(first.entry);
    const full = core.registry.admit({ kind: "theme", bytes: read(GRAPHITE), trust: "trusted" });
    expect([full.status, full.error?.kind]).toEqual(["refused", "registry-capacity"]);
    expect(core.registry.snapshot().entries.map((e) => e.id)).toEqual(["org.opentheme.aurora"]);
  });

  it("removes entries into a new snapshot and leaves old snapshots unchanged", () => {
    const core = createCore();
    const { entry } = core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
    const before = core.registry.snapshot();
    const after = core.registry.remove(entry!);
    expect(after.entries).toEqual([]);
    expect(before.entries).toHaveLength(1);
  });

  it("validates settings", () => {
    expect(() => createCore({ registryCapacity: 0 })).toThrow(/invalid-argument/);
    expect(() => createCore({ untrustedSources: { web: true } as never })).toThrow(/invalid-argument/);
    expect(() => createCore({ bogus: 1 } as never)).toThrow(/invalid-argument/);
  });
});

describe("admitFrom", () => {
  it("admits through a host source and reports source-load-failed", async () => {
    const core = createCore();
    const ok = await core.registry.admitFrom({ load: async () => read(AURORA) }, { kind: "theme", trust: "trusted" });
    expect(ok.status).toBe("registered");
    const failed = await core.registry.admitFrom(
      { load: () => Promise.reject(new Error("offline")) },
      { kind: "theme", trust: "trusted" },
    );
    expect([failed.status, failed.error?.kind]).toEqual(["refused", "source-load-failed"]);
    let loaded = false;
    const refused = await core.registry.admitFrom(
      {
        load: async () => {
          loaded = true;
          return read(AURORA);
        },
      },
      { kind: "theme", trust: "untrusted", source: "shared" },
    );
    expect([refused.error?.kind, loaded]).toEqual(["source-not-allowed", false]);
  });
});

describe("gated bases", () => {
  it("never selects a gated entry that is present only as a base", () => {
    const core = createCore({ untrustedSources: { imported: true, shared: true } });
    const base = JSON.parse(read(GRAPHITE)) as Record<string, unknown>;
    base.id = "com.example.base";
    delete base.integrity;
    core.registry.admit({ kind: "theme", bytes: JSON.stringify(base), trust: "untrusted", source: "imported" });
    const child = {
      opentheme: "1.0",
      id: "com.example.child",
      version: "1.0.0",
      name: "Child",
      provenance: { origin: "user-created" },
      compatibility: { catalog: "1.0" },
      extends: { id: "com.example.base", version: "^1.0.0" },
      colorSchemes: base.colorSchemes,
      seeds: base.seeds,
    };
    const r = core.registry.admit({ kind: "theme", bytes: JSON.stringify(child), trust: "untrusted", source: "shared" });
    expect(r.status).toBe("registered");
    core.updateSettings({ untrustedSources: { imported: false, shared: true } });
    const snapshot = core.registry.snapshot();
    const policy = { availableThemes: ["com.example.base", "com.example.child"], defaultTheme: "org.opentheme.baseline" };
    const direct = core.resolve(snapshot, { ...request("com.example.base", core, []), policy });
    expect(direct.ok && (direct.resolved.applied as { id: string }).id).toBe("org.opentheme.baseline");
    const viaChild = core.resolve(snapshot, { ...request("com.example.child", core, []), policy });
    expect(viaChild.ok && (viaChild.resolved.applied as { id: string }).id).toBe("com.example.child");
  });
});
