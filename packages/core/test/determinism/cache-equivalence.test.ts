/**
 * Caches are invisible (FR-C071, FR-C072; SC-C003): every resolution fixture, admitted into Core
 * and resolved with the result cache at its default, at 0, and at 1, gives byte-identical output.
 */
import { describe, expect, it } from "vitest";
import { createCore } from "../../src/index.js";
import { bytesOf, fixtures } from "../fixtures.js";

const cases = fixtures("resolution").filter((f) => f.kind === "resolve");
const ALL = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;

function runAll(results: number, preparedThemes = 16): string[] {
  const out: string[] = [];
  for (const f of cases) {
    const core = createCore({ untrustedSources: ALL, accessibilityGate: "relaxed", cache: { results, preparedThemes } });
    const input = f.input as Record<string, unknown> & { themes?: { trust?: string; document: unknown }[] };
    if (input.host) core.registry.admit({ kind: "host", bytes: bytesOf(input.host), trust: "trusted" });
    for (const t of input.themes ?? []) {
      const trusted = t.trust === "trusted";
      core.registry.admit({ kind: "theme", bytes: bytesOf(t.document), trust: trusted ? "trusted" : "untrusted", ...(trusted ? {} : { source: "shared" }) });
    }
    if (input.theme) core.registry.admit({ kind: "theme", bytes: bytesOf(input.theme), trust: "trusted" });
    const request = {
      policy: (input.policy ?? {}) as never,
      selection: input.selection as never,
      previous: (input.previous ?? null) as never,
      preferences: (input.preferences ?? {}) as never,
      platform: input.platform as never,
      environment: input.environment as never,
    };
    const snapshot = core.registry.snapshot();
    const first = JSON.stringify(core.resolve(snapshot, request));
    const second = JSON.stringify(core.resolve(snapshot, request));
    expect(second).toBe(first);
    out.push(first);
  }
  return out;
}

describe("cache equivalence", () => {
  it("gives identical bytes with the result cache at 32, 0, and 1", () => {
    expect(cases.length).toBeGreaterThan(50);
    const a = runAll(32);
    expect(runAll(0)).toEqual(a);
    expect(runAll(1)).toEqual(a);
  });

  it("gives identical bytes with prepared themes at 16, 0, and 1", () => {
    const a = runAll(0, 16);
    expect(runAll(0, 0)).toEqual(a);
    expect(runAll(0, 1)).toEqual(a);
  });
});
