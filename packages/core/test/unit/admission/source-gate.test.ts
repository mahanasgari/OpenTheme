/** Untrusted source categories (FR-C024, FR-C026; SC-C012). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { GRAPHITE, read } from "../../helpers.js";

const SOURCES = ["user-created", "imported", "shared", "ai-generated"] as const;

function withOrigin(origin: string): string {
  const doc = JSON.parse(read(GRAPHITE)) as Record<string, unknown>;
  doc.id = "com.example.copy";
  doc.provenance = { origin };
  delete doc.integrity;
  return JSON.stringify(doc);
}

describe("source categories", () => {
  it("are all off by default", () => {
    const core = createCore();
    expect(core.settings.untrustedSources).toEqual({ "user-created": false, imported: false, shared: false, "ai-generated": false });
    for (const source of SOURCES) {
      const r = core.registry.admit({ kind: "theme", bytes: withOrigin(source), trust: "untrusted", source });
      expect(r.error?.kind).toBe("source-not-allowed");
    }
  });

  it("use the stated category, never the document's provenance", () => {
    // Provenance claims a disabled category; the stated, enabled one decides.
    const allowed = createCore({ untrustedSources: { shared: true } });
    expect(allowed.registry.admit({ kind: "theme", bytes: withOrigin("imported"), trust: "untrusted", source: "shared" }).status).toBe(
      "registered",
    );
    // Provenance claims the enabled category; the stated, disabled one decides.
    const denied = createCore({ untrustedSources: { imported: true } });
    const r = denied.registry.admit({ kind: "theme", bytes: withOrigin("imported"), trust: "untrusted", source: "ai-generated" });
    expect(r.error?.kind).toBe("source-not-allowed");
    // A trusted admission is unaffected by any category, and takes none.
    expect(denied.registry.admit({ kind: "theme", bytes: withOrigin("ai-generated"), trust: "trusted" }).status).toBe("registered");
    const mixed = denied.registry.admit({ kind: "theme", bytes: withOrigin("prebuilt"), trust: "trusted", source: "imported" });
    expect(mixed.error?.kind).toBe("invalid-argument");
  });
});
