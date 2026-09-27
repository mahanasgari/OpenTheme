/**
 * Trust and untrusted-source checks (FR-C020, FR-C024, FR-C026; research CR13). They run before
 * any size check or parsing, and never look at the document: trust and the source category come
 * only from the host.
 */
import { type OperationalError, operationalError } from "../errors/operational.js";
import { type EffectiveSettings, UNTRUSTED_SOURCES, type UntrustedSource } from "../settings.js";

export type Trust = "trusted" | "untrusted";

export function isUntrustedSource(v: unknown): v is UntrustedSource {
  return typeof v === "string" && (UNTRUSTED_SOURCES as readonly string[]).includes(v);
}

/** The refusal for a request's trust and source, or `null` when admission may proceed. */
export function checkTrustAndSource(
  trust: unknown,
  source: unknown,
  settings: EffectiveSettings,
  operation: string,
): OperationalError | null {
  if (trust !== "trusted" && trust !== "untrusted") {
    return operationalError("trust-missing", operation, 'Admission needs trust: "trusted" or "untrusted", assigned by the host.', "/trust");
  }
  if (trust === "trusted") {
    return source === undefined || source === null
      ? null
      : operationalError("invalid-argument", operation, "Trusted admissions carry no source category.", "/source");
  }
  if (source === undefined || source === null) {
    return operationalError("source-missing", operation, "Untrusted admissions need a source category.", "/source");
  }
  if (!isUntrustedSource(source)) {
    return operationalError("source-unknown", operation, "The source category is not one of the four known categories.", "/source");
  }
  if (!settings.untrustedSources[source]) {
    return operationalError("source-not-allowed", operation, `Untrusted themes from source "${source}" are not allowed.`, "/source");
  }
  return null;
}
