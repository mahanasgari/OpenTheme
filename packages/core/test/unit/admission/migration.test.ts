/** Previous-major documents are admitted only through a migration manifest (FR-C101; chapter 14). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { AURORA, read } from "../../helpers.js";

function previousMajor(opentheme: string): string {
  const doc = JSON.parse(read(AURORA)) as Record<string, unknown>;
  doc.id = "com.example.legacy";
  doc.opentheme = opentheme;
  doc.legacyField = true;
  delete doc.integrity;
  return JSON.stringify(doc);
}

const manifest = { from: "0.x", to: "1.0", operations: [{ op: "drop-member", at: "/legacyField", lossy: true }] };

describe("previous-major admission", () => {
  it("migrates a previous-major theme, reports it, and keeps the admission's trust", () => {
    const core = createCore({ untrustedSources: { imported: true } });
    const r = core.registry.admit({ kind: "theme", bytes: previousMajor("0.9"), trust: "untrusted", source: "imported", migration: manifest });
    expect(r.status).toBe("registered");
    expect(r.entry?.trust).toBe("untrusted");
    expect(r.diagnostics.map((d) => d.code)).toEqual(expect.arrayContaining(["OT-VER-003", "OT-VER-004"]));
  });

  it("rejects a previous-major theme without a manifest, and never migrates across two majors", () => {
    const core = createCore();
    const plain = core.registry.admit({ kind: "theme", bytes: previousMajor("0.9"), trust: "trusted" });
    expect(plain.status).not.toBe("registered");
    expect(plain.diagnostics.map((d) => d.code)).toContain("OT-VER-001");
    const far = core.registry.admit({
      kind: "theme",
      bytes: previousMajor("2.0"),
      trust: "trusted",
      migration: { ...manifest, from: "2.x" },
    });
    expect(far.status).not.toBe("registered");
    expect(far.diagnostics.map((d) => d.code)).not.toContain("OT-VER-003");
  });

  it("refuses a malformed manifest as a caller error", () => {
    expect(() =>
      createCore().registry.admit({ kind: "theme", bytes: previousMajor("0.9"), trust: "trusted", migration: { from: 0 } as never }),
    ).toThrow(/invalid-argument/);
  });
});
