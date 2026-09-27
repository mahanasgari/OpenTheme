/** Trust is host-assigned only (FR-C020, FR-C021; SC-C007). */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { AURORA, read } from "../../helpers.js";

const aurora = JSON.parse(read(AURORA)) as Record<string, unknown>;
const ORIGINS = ["specification-baseline", "prebuilt", "developer-authored", "user-created", "imported", "ai-generated", "ai-assisted"];

const variant = fc.record({
  id: fc.constantFrom("org.opentheme.aurora", "org.opentheme.baseline", "com.example.x", "uid.abcdefghijklmnopqrstuv2345"),
  version: fc.constantFrom("1.0.0", "9.9.9", "0.0.1-rc.1"),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  author: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  origin: fc.constantFrom(...ORIGINS),
  lineage: fc.array(fc.record({ id: fc.constantFrom("org.opentheme.graphite", "com.example.y"), version: fc.constant("1.0.0") }), {
    maxLength: 3,
  }),
  extensions: fc.option(fc.dictionary(fc.constantFrom("com.example.flags", "org.opentheme.trust"), fc.jsonValue()), { nil: undefined }),
  trust: fc.constantFrom("trusted" as const, "untrusted" as const),
});

describe("trust", () => {
  it("refuses a missing trust before parsing anything", () => {
    const r = createCore().registry.admit({ kind: "theme", bytes: "\u0000 not json", trust: undefined as never });
    expect([r.status, r.error?.kind, r.diagnostics.length]).toEqual(["refused", "trust-missing", 0]);
  });

  it("reports exactly the host-assigned trust whatever the document claims", () => {
    fc.assert(
      fc.property(variant, (v) => {
        const doc: Record<string, unknown> = {
          ...aurora,
          id: v.id,
          version: v.version,
          name: v.name,
          provenance: { origin: v.origin, lineage: v.lineage },
          ...(v.author !== undefined ? { author: v.author } : {}),
          ...(v.extensions !== undefined ? { $extensions: v.extensions } : {}),
        };
        delete doc.integrity;
        const core = createCore({ untrustedSources: { "ai-generated": true } });
        const r = core.registry.admit({
          kind: "theme",
          bytes: JSON.stringify(doc),
          trust: v.trust,
          ...(v.trust === "untrusted" ? { source: "ai-generated" as const } : {}),
        });
        if (r.entry) expect(r.entry.trust).toBe(v.trust);
        for (const e of core.registry.snapshot().entries) expect(e.trust).toBe(v.trust);
        expect(core.registry.snapshot().baseline.trust).toBe("trusted");
      }),
      { numRuns: 1000, seed: 20260925 },
    );
  });
});
