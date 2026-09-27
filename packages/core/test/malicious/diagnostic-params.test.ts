/**
 * FR-C086, FR-071: diagnostic `params` and operational errors never reproduce untrusted free
 * text. Every malicious and invalid document is admitted as untrusted and resolved; no reported
 * string may contain a free-text string (3+ characters) taken from the document's string values
 * or member names. Grammar-constrained identifiers (token paths, ids, codes: letters, digits,
 * `.`, `-`, `_`, `/`) are what params are made of, so they are not free text.
 */
import { describe, expect, it } from "vitest";
import { createCore, type Diagnostic, type OperationalError } from "../../src/index.js";
import { LIGHT_CONTEXT } from "../helpers.js";
import { bytesOf, fixtures } from "../fixtures.js";

const IDENTIFIER = /^[A-Za-z0-9._/-]+$/;
const ALL_SOURCES = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;

function freeText(doc: unknown, out = new Set<string>()): Set<string> {
  if (typeof doc === "string") {
    if (doc.length >= 3 && !IDENTIFIER.test(doc)) out.add(doc);
  } else if (Array.isArray(doc)) {
    for (const v of doc) freeText(v, out);
  } else if (doc && typeof doc === "object") {
    for (const [k, v] of Object.entries(doc)) {
      if (k.length >= 3 && !IDENTIFIER.test(k)) out.add(k);
      freeText(v, out);
    }
  }
  return out;
}

function reported(diagnostics: readonly Diagnostic[], error: OperationalError | null): string[] {
  const out: string[] = [];
  for (const d of diagnostics) {
    for (const v of Object.values(d.params)) out.push(...(Array.isArray(v) ? v : [String(v)]));
  }
  if (error) out.push(error.message, error.hint, error.pointer ?? "");
  return out;
}

const cases = fixtures("malicious", "invalid").filter((f) => f.kind === "validate" && typeof f.input.theme === "object");

describe("no untrusted free text in params or operational errors", () => {
  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const core = createCore({ untrustedSources: ALL_SOURCES });
    const r = core.registry.admit({ kind: "theme", bytes: bytesOf(f.input.theme), trust: "untrusted", source: "shared" });
    const strings = reported(r.diagnostics, r.error);
    if (r.entry) {
      const result = core.resolve(core.registry.snapshot(), {
        policy: { availableThemes: [r.entry.id], defaultTheme: "org.opentheme.baseline" },
        selection: { id: r.entry.id },
        previous: null,
        preferences: {},
        ...LIGHT_CONTEXT,
      });
      if (result.ok) strings.push(...reported(result.diagnostics, null));
    }
    const forbidden = [...freeText(f.input.theme)];
    for (const s of strings) {
      for (const t of forbidden) expect(s.includes(t), `param "${s}" reproduces "${t}"`).toBe(false);
    }
  });
});

it("has free text to look for (the check is not vacuous)", () => {
  const total = cases.reduce((n, f) => n + freeText(f.input.theme).size, 0);
  expect(total).toBeGreaterThan(50);
});
