/**
 * User Preferences document → the `selection`, `previous`, and `preferences` members of a
 * Resolution Request (FR-C067; data-model §8). Entries that are not permitted literals
 * (`OT-PREF-008`) are omitted. Compiling never changes the document (FR-C063).
 */
import type { Json } from "../parse/ijson.js";
import { isPermittedLiteral, type UserPreferencesDocument } from "./document.js";

export interface CompiledPreferences {
  readonly selection: { readonly id: string; readonly version?: string };
  readonly previous: { readonly id: string; readonly version: string } | null;
  readonly preferences: Readonly<Record<string, Json>>;
}

/** `defaultTheme` stands in for a `null` selection (the developer default, FB-001). */
export function compilePreferences(doc: UserPreferencesDocument, defaultTheme: string): CompiledPreferences {
  const preferences: Record<string, Json> = {};
  for (const [k, v] of Object.entries(doc.values)) if (isPermittedLiteral(v)) preferences[k] = v;
  const selection = doc.selection
    ? { id: doc.selection.id, ...(doc.selection.version !== undefined ? { version: doc.selection.version } : {}) }
    : { id: defaultTheme };
  return { selection, previous: doc.previous ? { id: doc.previous.id, version: doc.previous.version } : null, preferences };
}
