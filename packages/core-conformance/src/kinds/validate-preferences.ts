import { parsePreferences } from "@opentheme/core/internal-conformance";

/** `validate-preferences`: User Preferences document (chapter 18). */
export function validatePreferences(input: unknown): Record<string, unknown> {
  const p = input as { document?: unknown };
  const r = parsePreferences(p.document);
  return { usable: r.document !== null, values: r.values, diagnostics: r.diagnostics };
}
