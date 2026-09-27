/**
 * Flatten inheritance for export (FR-049): base-first merge, drop extends, append lineage.
 */
import {
  mergeThemeDocuments,
  resolveInheritanceChain,
  type ThemeWithTrust,
} from "../validate/inheritance.js";
import { DiagnosticCollector } from "../diagnostics/collector.js";
import type { Diagnostic } from "../diagnostics/collector.js";

export interface FlattenResult {
  document: Record<string, unknown>;
  diagnostics: Diagnostic[];
  ok: boolean;
}

export function flattenTheme(
  theme: Record<string, unknown>,
  bases: ThemeWithTrust[] = [],
): FlattenResult {
  const collector = new DiagnosticCollector();
  if (theme.extends === undefined) {
    const out = structuredClone(theme) as Record<string, unknown>;
    delete out.extends;
    return { document: out, diagnostics: collector.finish(), ok: true };
  }
  const inherited = resolveInheritanceChain(theme, bases, collector);
  if (!inherited) {
    return {
      document: theme,
      diagnostics: collector.finish(),
      ok: false,
    };
  }
  const merged = mergeThemeDocuments(inherited.chain, theme);
  delete merged.extends;
  const lineage: Array<{ id: string; version: string }> = [];
  for (const base of inherited.chain) {
    lineage.push({
      id: String(base.id ?? ""),
      version: String(base.version ?? "0.0.0"),
    });
  }
  const provenance = {
    ...((merged.provenance as object) ?? {}),
    lineage,
  };
  merged.provenance = provenance;
  return {
    document: merged,
    diagnostics: collector.finish(),
    ok: true,
  };
}

/**
 * Export eligibility: author, license, and integrity required (OT-META-008).
 */
export function checkExportEligibility(
  theme: Record<string, unknown>,
): { eligible: boolean; diagnostics: Diagnostic[] } {
  const collector = new DiagnosticCollector();
  const missing: string[] = [];
  if (!theme.author) missing.push("author");
  if (!theme.license) missing.push("license");
  if (!theme.integrity) missing.push("integrity");
  if (missing.length > 0) {
    collector.add({
      code: "OT-META-008",
      rule: "R-META-008",
      location: { document: "theme", pointer: "/" },
      params: { detail: missing.join(",") },
    });
  }
  const diagnostics = collector.finish();
  return {
    eligible: diagnostics.length === 0,
    diagnostics,
  };
}
