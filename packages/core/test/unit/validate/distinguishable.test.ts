/** OT-A11Y-004 in the accessibility conformance report (chapter 11, finding C4). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { AURORA, GRAPHITE, read } from "../../helpers.js";

type Doc = Record<string, unknown> & { contexts?: unknown[] };

/** Aurora under a new id whose warning background nearly equals the primary action background. */
function lookalike(when: Record<string, string>): string {
  const doc = JSON.parse(read(AURORA)) as Doc;
  doc.id = "com.example.lookalike";
  delete doc.integrity;
  doc.contexts = [
    ...(doc.contexts ?? []),
    { when, tokens: { color: { status: { warning: { background: { $value: { colorSpace: "oklch", components: [0.56, 0.16, 275] } } } } } } },
  ];
  return JSON.stringify(doc);
}

function admit(bytes: string, trust: "trusted" | "untrusted") {
  const core = createCore({ untrustedSources: { "user-created": true } });
  return core.registry.admit({ kind: "theme", bytes, trust, ...(trust === "untrusted" ? { source: "user-created" } : {}) });
}

describe("OT-A11Y-004 distinguishable roles", () => {
  it("reports a standard-contrast shortfall at the declaration of pair member a", () => {
    const r = admit(lookalike({ colorScheme: "light", contrast: "standard" }), "trusted");
    expect(r.status).toBe("registered");
    const found = r.diagnostics.filter((d) => d.code === "OT-A11Y-004");
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
    expect(found[0]?.location.pointer).toBe("/contexts/2/tokens/color/status/warning/background");
  });

  it("does not report a shortfall that exists only in a high-contrast mode", () => {
    const r = admit(lookalike({ colorScheme: "light", contrast: "high" }), "trusted");
    expect(r.diagnostics.some((d) => d.code === "OT-A11Y-004")).toBe(false);
  });

  it("never refuses an untrusted admission under the enforced gate", () => {
    const r = admit(lookalike({ colorScheme: "light", contrast: "standard" }), "untrusted");
    expect(r.status).toBe("registered");
    expect(r.entry?.gate).toBe("pass");
    expect(r.diagnostics.some((d) => d.code === "OT-A11Y-004")).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "OT-A11Y-003")).toBe(false);
  });

  it("leaves the official themes with an empty report", () => {
    for (const path of [AURORA, GRAPHITE]) {
      const r = admit(read(path), "trusted");
      expect(r.diagnostics.filter((d) => d.code === "OT-A11Y-004")).toEqual([]);
    }
  });
});
