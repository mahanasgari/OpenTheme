/**
 * Every malicious and invalid theme and host document, admitted as untrusted with its source
 * allowed: the expected findings are reported and nothing becomes selectable (SC-C005).
 */
import { describe, expect, it } from "vitest";
import { createCore } from "../../src/index.js";
import { LIGHT_CONTEXT } from "../helpers.js";
import { bytesOf, fixtures } from "../fixtures.js";

const ALL_SOURCES = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;
const cases = fixtures("malicious", "invalid").filter((f) => f.kind === "validate" || f.kind === "validate-host");

describe("malicious and invalid documents", () => {
  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const core = createCore({ untrustedSources: ALL_SOURCES });
    const kind = f.kind === "validate-host" ? "host" : "theme";
    if (kind === "theme" && f.input.host !== undefined) {
      core.registry.admit({ kind: "host", bytes: bytesOf(f.input.host), trust: "trusted" });
    }
    const doc = kind === "host" ? f.input.host : f.input.theme;
    const r = core.registry.admit({ kind, bytes: bytesOf(doc), trust: "untrusted", source: "imported" });
    const got = r.diagnostics.map((d) => `${d.code} ${d.location.document}${d.location.pointer}`);
    for (const d of f.expect.diagnostics ?? []) {
      const where = d.location ? ` ${d.location.document}${d.location.pointer}` : "";
      expect(got.some((g) => (where ? g === `${d.code}${where}` : g.startsWith(`${d.code} `))), `${d.code}${where}`).toBe(true);
    }
    if (f.expect.validity === "invalid") {
      expect(["invalid", "refused"]).toContain(r.status);
      const snapshot = core.registry.snapshot();
      const ids = snapshot.entries.map((e) => e.id);
      expect(core.listSelectable(snapshot, { availableThemes: ids }, "en")).toEqual([]);
      if (kind === "theme" && r.entry) {
        const result = core.resolve(snapshot, {
          policy: { availableThemes: ids, defaultTheme: "org.opentheme.baseline" },
          selection: { id: r.entry.id },
          previous: null,
          preferences: {},
          ...LIGHT_CONTEXT,
        });
        expect(result.ok && (result.resolved.applied as { id: string }).id).toBe("org.opentheme.baseline");
      }
    }
  });
});
