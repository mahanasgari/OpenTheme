/**
 * The accessibility gate (FR-C028; research CR13). An untrusted valid theme with any
 * `OT-A11Y-003` in the accessibility conformance report (chapter 11) is refused while the gate is
 * enforced. Trusted themes are never refused; their shortfalls are reported only (FR-064).
 */
import type { Diagnostic } from "../diagnostics/collector.js";
import type { EffectiveSettings } from "../settings.js";
import type { Trust } from "./sources.js";

export type Gate = "pass" | "refused-accessibility" | "refused-source" | "not-applicable";

export function gateFor(
  trust: Trust,
  source: string | null,
  valid: boolean,
  report: readonly Diagnostic[],
  settings: EffectiveSettings,
): Gate {
  if (trust === "trusted" || !valid) return "not-applicable";
  // `source` is null for a trusted admission whose inheritance chain is untrusted.
  if (source !== null && !settings.untrustedSources[source as keyof EffectiveSettings["untrustedSources"]]) {
    return "refused-source";
  }
  if (settings.accessibilityGate === "enforce" && report.some((d) => d.code === "OT-A11Y-003")) {
    return "refused-accessibility";
  }
  return "pass";
}
