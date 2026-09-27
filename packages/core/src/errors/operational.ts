/**
 * Core operational errors (FR-C083; contracts/operational-errors.md). These report failures that
 * are not findings about a document. Kinds never use the `OT-` prefix.
 */

export const OPERATIONAL_ERROR_KINDS = [
  "trust-missing",
  "source-missing",
  "source-unknown",
  "source-not-allowed",
  "accessibility-gate",
  "registry-capacity",
  "source-load-failed",
  "superseded",
  "store-read-failed",
  "store-write-failed",
  "invalid-context",
  "invalid-argument",
  "unknown-theme",
  "unknown-preset",
  "disposed",
  "deprecated-api",
] as const;

export type OperationalErrorKind = (typeof OPERATIONAL_ERROR_KINDS)[number];

export interface OperationalError {
  readonly kind: OperationalErrorKind;
  readonly operation: string;
  readonly pointer?: string;
  readonly message: string;
  readonly hint: string;
  readonly docs: string;
}

const DOCS_BASE = "https://opentheme.org/core/errors/";

const HINTS: Record<OperationalErrorKind, string> = {
  "trust-missing": "Pass trust: \"trusted\" only for documents bundled at build time; otherwise \"untrusted\".",
  "source-missing": "Untrusted admissions need source: user-created, imported, shared, or ai-generated.",
  "source-unknown": "Use one of: user-created, imported, shared, ai-generated.",
  "source-not-allowed": "Enable settings.untrustedSources.<source> if this host accepts such themes.",
  "accessibility-gate": "The theme misses WCAG 2.2 AA; fix the reported pairs or set accessibilityGate: \"relaxed\" explicitly.",
  "registry-capacity": "Remove unused entries or raise settings.registryCapacity.",
  "source-load-failed": "Check the ThemeSource implementation; Core performs no I/O itself.",
  superseded: "A newer change completed first; no action is needed.",
  "store-read-failed": "Check the PreferenceStore implementation; resolution continued without stored data.",
  "store-write-failed": "Check the PreferenceStore implementation; the change applies but was not persisted.",
  "invalid-context": "Supply platform and environment values from the resolution-input schema.",
  "invalid-argument": "Check the argument against the typed API.",
  "unknown-theme": "Use an id that is registered in the snapshot.",
  "unknown-preset": "Use \"closed\" or \"common-personalization\".",
  disposed: "Create a new controller; this one was disposed.",
  "deprecated-api": "Move to the replacement named in the message before the next major version.",
};

export function operationalError(
  kind: OperationalErrorKind,
  operation: string,
  message: string,
  pointer?: string,
): OperationalError {
  return Object.freeze({
    kind,
    operation,
    ...(pointer !== undefined ? { pointer } : {}),
    message,
    hint: HINTS[kind],
    docs: `${DOCS_BASE}${kind}`,
  });
}

/** Thrown only for programming errors against the typed API (contracts/operational-errors.md). */
export class OpenThemeCoreError extends Error {
  readonly error: OperationalError;

  constructor(error: OperationalError) {
    super(`${error.kind}: ${error.message}`);
    this.name = "OpenThemeCoreError";
    this.error = error;
  }
}
