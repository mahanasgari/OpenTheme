/**
 * Preview state (FR-C081; constitution VI): a pending change applied to resolution but never
 * persisted. Accepting commits it to the document; cancelling restores the previous inputs.
 */
import type { Json } from "../parse/ijson.js";
import type { UserPreferencesDocument } from "../preferences/document.js";

export interface PreviewChange {
  readonly selection?: { readonly id: string; readonly version?: string };
  readonly values?: Readonly<Record<string, unknown>>;
}

/** The document the preview would produce if accepted. */
export function applyPreview(doc: UserPreferencesDocument, preview: PreviewChange | null): UserPreferencesDocument {
  if (!preview) return doc;
  return {
    ...doc,
    ...(preview.selection ? { selection: { ...preview.selection } } : {}),
    values: { ...doc.values, ...(preview.values as Record<string, Json> | undefined) },
  };
}
