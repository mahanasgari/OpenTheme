/**
 * Validity and gate evaluation of a theme entry against a theme set, a host declaration, and the
 * current settings (FR-C027, FR-C028, FR-C041). Admission uses it once; snapshots re-run it when
 * a base, the host declaration, or the settings change.
 */
import { gateFor, type Gate } from "../admission/a11y-gate.js";
import type { Trust } from "../admission/sources.js";
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import type { EffectiveSettings } from "../settings.js";
import { conformanceReport } from "../validate/accessibility.js";
import { type BaseEntry, type ThemeValidation, validateThemeDocument } from "../validate/theme.js";
import type { Validity } from "./snapshot.js";
import type { Prepared } from "../resolve/prepare.js";

export interface ThemeEvaluation {
  readonly validity: Validity;
  readonly gate: Gate;
  /** Validation diagnostics plus the accessibility conformance report (chapter 13 order). */
  readonly diagnostics: readonly Diagnostic[];
  readonly merged: Readonly<Record<string, unknown>> | null;
}

export function evaluateTheme(
  document: Readonly<Record<string, unknown>>,
  trust: Trust,
  source: string | null,
  bases: readonly BaseEntry[],
  host: Readonly<Record<string, unknown>> | null,
  settings: EffectiveSettings,
  prepared: Prepared | undefined,
  /** A validation of `document` under the same bases and host, when the caller already has one. */
  validation: ThemeValidation = validateThemeDocument(document, { bases, host, ...(prepared ? { prepared } : {}) }),
): ThemeEvaluation {
  const validity: Validity = validation.valid ? "valid" : validation.unsupported ? "unsupported" : "invalid";
  const merged = validation.valid ? (validation.merged ?? document) : null;
  const c = new DiagnosticCollector("theme");
  c.addAll(validation.diagnostics);
  const report = new DiagnosticCollector("theme");
  if (merged) conformanceReport(merged, host, report, prepared);
  const shortfalls = report.finish();
  c.addAll(shortfalls);
  // Chain trust is the lowest trust along the chain (FR-C023): a trusted child of an untrusted
  // base is gated as untrusted. Only an untrusted admission has a source to check.
  const effectiveTrust: Trust = trust === "trusted" && validation.chainTrust !== "untrusted" ? "trusted" : "untrusted";
  const gate = gateFor(effectiveTrust, trust === "untrusted" ? source : null, validity === "valid", shortfalls, settings);
  // A capped validation list (ending in OT-LIM-099) is already the first 200 findings; merging
  // into it would drop a finding and repeat the marker, so it is kept as it is.
  const capped = validation.diagnostics.some((d) => d.code === "OT-LIM-099");
  return { validity, gate, diagnostics: capped ? validation.diagnostics : c.finish(), merged };
}
