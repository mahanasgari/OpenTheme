/** OT-META-002: the reserved `org.opentheme.` prefix is invalid for untrusted themes (finding C1). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { validateTheme } from "../../../src/validate/theme.js";
import { AURORA, LIGHT_CONTEXT, read } from "../../helpers.js";

const aurora = (id: string): string => {
  const doc = JSON.parse(read(AURORA)) as Record<string, unknown>;
  doc.id = id;
  delete doc.integrity;
  return JSON.stringify(doc);
};

describe("reserved identifier prefix at admission", () => {
  it("makes an untrusted org.opentheme.* theme invalid with OT-META-002 at /id", () => {
    const core = createCore({ untrustedSources: { imported: true } });
    const r = core.registry.admit({ kind: "theme", bytes: aurora("org.opentheme.lookalike"), trust: "untrusted", source: "imported" });
    expect(r.entry?.validity).toBe("invalid");
    const found = r.diagnostics.filter((d) => d.code === "OT-META-002");
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("error");
    expect(found[0]?.location).toEqual({ document: "theme", pointer: "/id" });
  });

  it("does not apply to a trusted admission, whatever the document claims", () => {
    const r = createCore().registry.admit({ kind: "theme", bytes: aurora("org.opentheme.lookalike"), trust: "trusted" });
    expect(r.entry?.validity).toBe("valid");
    expect(r.diagnostics.some((d) => d.code === "OT-META-002")).toBe(false);
  });

  it("does not apply to other identifiers of an untrusted theme", () => {
    const core = createCore({ untrustedSources: { imported: true } });
    const r = core.registry.admit({ kind: "theme", bytes: aurora("com.example.opentheme"), trust: "untrusted", source: "imported" });
    expect(r.entry?.validity).toBe("valid");
    expect(r.diagnostics.some((d) => d.code === "OT-META-002")).toBe(false);
  });

  it("falls back when the untrusted official-looking theme is selected", () => {
    const core = createCore({ untrustedSources: { imported: true } });
    core.registry.admit({ kind: "theme", bytes: aurora("org.opentheme.lookalike"), trust: "untrusted", source: "imported" });
    const result = core.resolve(core.registry.snapshot(), {
      policy: { availableThemes: ["org.opentheme.lookalike"], defaultTheme: "org.opentheme.baseline" },
      selection: { id: "org.opentheme.lookalike" },
      previous: null,
      preferences: {},
      ...LIGHT_CONTEXT,
    });
    expect(result.ok && (result.resolved.applied as { id: string; fallback: string }).id).toBe("org.opentheme.baseline");
  });

  it("is not applied by validation without a trust level", () => {
    const v = validateTheme(aurora("org.opentheme.lookalike"));
    expect(v.diagnostics.some((d) => d.code === "OT-META-002")).toBe(false);
  });
});
