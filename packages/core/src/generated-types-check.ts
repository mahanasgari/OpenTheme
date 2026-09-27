/**
 * Compile-time verification that Core's public types agree with the specification schemas
 * (FR-C104): the hand-written diagnostic shape is assignable to the schema-generated one, and the
 * resolution output is typed by the schema-generated Resolved Theme. Contains no runtime code.
 */
import type { Diagnostic as CoreDiagnostic } from "./diagnostics/collector.js";
import type { Diagnostic as SchemaDiagnostic, UserPreferences } from "./generated/types/index.js";
import type { UserPreferencesDocument } from "./preferences/document.js";

type Assert<T extends true> = T;
type Assignable<A, B> = [A] extends [B] ? true : false;
/** Core returns frozen values, so its arrays are read-only; compare against the read-only form. */
type DeepReadonly<T> = T extends (infer E)[] ? readonly DeepReadonly<E>[] : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export type DiagnosticMatchesSchema = Assert<Assignable<CoreDiagnostic, DeepReadonly<SchemaDiagnostic>>>;
export type PreferencesMatchSchema = Assert<Assignable<UserPreferencesDocument, DeepReadonly<UserPreferences>>>;
