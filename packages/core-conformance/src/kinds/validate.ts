import { validateTheme } from "@opentheme/core/internal-conformance";

type Entry = { trust?: string; document?: unknown };

/** `validate`: theme validity and diagnostics (chapter 13). */
export function validate(input: unknown): Record<string, unknown> {
  const payload = input as { theme?: unknown; bases?: Entry[]; host?: unknown };
  const bases = (payload.bases ?? []).map((b) => {
    const e = b as Entry;
    return e && typeof e === "object" && "document" in e
      ? { trust: (e.trust === "trusted" ? "trusted" : "untrusted") as "trusted" | "untrusted", document: e.document as Record<string, unknown> }
      : { trust: "trusted" as const, document: b as Record<string, unknown> };
  });
  const host = payload.host && typeof payload.host === "object" ? (payload.host as Record<string, unknown>) : null;
  const theme = typeof payload.theme === "string" ? payload.theme : JSON.stringify(payload.theme);
  const r = validateTheme(theme, { bases, host });
  return { validity: r.valid ? "valid" : "invalid", diagnostics: r.diagnostics };
}
