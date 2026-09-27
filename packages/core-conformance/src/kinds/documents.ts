import { exportCheck as check, flattenTheme } from "@opentheme/core/internal-conformance";

type Entry = { trust?: string; document?: unknown };

function basesOf(raw: Entry[] | undefined) {
  return (raw ?? []).map((b) =>
    b && typeof b === "object" && "document" in b
      ? { trust: (b.trust === "untrusted" ? "untrusted" : "trusted") as "trusted" | "untrusted", document: b.document as Record<string, unknown> }
      : { trust: "trusted" as const, document: b as unknown as Record<string, unknown> },
  );
}

/** `flatten`: self-contained export form (chapter 15). */
export function flatten(input: unknown): Record<string, unknown> {
  const p = input as { theme: Record<string, unknown>; bases?: Entry[] };
  return { ...flattenTheme(p.theme, basesOf(p.bases)) };
}

/** `export-check`: export eligibility (chapter 15). */
export function exportCheck(input: unknown): Record<string, unknown> {
  const p = input as { theme: Record<string, unknown> };
  return { ...check(p.theme) };
}
