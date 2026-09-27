import { conformanceReport, DiagnosticCollector, validateTheme } from "@opentheme/core/internal-conformance";

type Entry = { trust?: string; document?: unknown };

/**
 * `accessibility-report` (chapter 11): the theme's validity and, for a valid theme, only the
 * accessibility conformance report's findings.
 */
export function accessibilityReport(input: unknown): Record<string, unknown> {
  const payload = input as { theme?: unknown; bases?: Entry[]; host?: unknown };
  const bases = (payload.bases ?? []).map((b) => {
    const e = b as Entry;
    return e && typeof e === "object" && "document" in e
      ? { trust: (e.trust === "untrusted" ? "untrusted" : "trusted") as "trusted" | "untrusted", document: e.document as Record<string, unknown> }
      : { trust: "trusted" as const, document: b as Record<string, unknown> };
  });
  const host = payload.host && typeof payload.host === "object" ? (payload.host as Record<string, unknown>) : null;
  const theme = typeof payload.theme === "string" ? payload.theme : JSON.stringify(payload.theme);
  const r = validateTheme(theme, { bases, host });
  if (!r.valid) return { validity: "invalid", diagnostics: [] };
  const c = new DiagnosticCollector("theme");
  conformanceReport(r.merged ?? r.document!, host, c);
  return { validity: "valid", diagnostics: c.finish() };
}
