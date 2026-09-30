/**
 * `core.documents.accessibilityReport` (finding L1, specs/004-theme-author-cli T019): the chapter 11
 * report through the public API equals every `accessibility-report` fixture's expected result.
 */
import { describe, expect, it } from "vitest";
import { createCore } from "../../src/index.js";
import { bytesOf, fixtures } from "../fixtures.js";

describe("documents.accessibilityReport", () => {
  const cases = fixtures("accessibility");
  it("covers the accessibility fixtures", () => expect(cases.length).toBeGreaterThanOrEqual(4));

  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const core = createCore();
    const input = f.input as { theme: unknown; bases?: { trust?: string; document: unknown }[]; host?: unknown };
    if (input.host) core.registry.admit({ kind: "host", bytes: bytesOf(input.host), trust: "trusted" });
    for (const b of input.bases ?? []) core.registry.admit({ kind: "theme", bytes: bytesOf(b.document), trust: "trusted" });
    const admitted = core.registry.admit({ kind: "theme", bytes: bytesOf(input.theme), trust: "trusted" });
    const snapshot = core.registry.snapshot();
    const entry = admitted.entry ?? snapshot.entries.find((e) => e.kind === "theme")!;
    const r = core.documents.accessibilityReport(entry, snapshot);
    if ("ok" in r) throw new Error(r.error.message);
    expect(r.validity).toBe(f.expect.validity);
    expect(r.diagnostics.map((d) => `${d.code}|${d.location.document}|${d.location.pointer}`)).toEqual(
      (f.expect.diagnostics ?? []).map((d) => `${d.code}|${d.location?.document}|${d.location?.pointer}`),
    );
  });

  it("an unknown entry is an operational error", () => {
    const core = createCore();
    const r = core.documents.accessibilityReport({ kind: "theme", id: "org.example.none", version: "1.0.0", integrity: "x", trust: "trusted" }, core.registry.snapshot());
    expect(r).toMatchObject({ ok: false, error: { kind: "unknown-theme" } });
  });
});
