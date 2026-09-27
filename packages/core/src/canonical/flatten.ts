/**
 * Flattening for interchange (chapter 15, FR-049) and export eligibility (FR-007, FR-095).
 */
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";
import { type BaseEntry, mergeChain, resolveChain } from "../validate/theme.js";

export interface FlattenResult {
  readonly ok: boolean;
  readonly document: Record<string, unknown>;
  readonly lineage: readonly { readonly id: string; readonly version: string }[];
  readonly diagnostics: Diagnostic[];
}

/** Merge the extends chain base-first, drop `extends`, append lineage oldest-first. */
export function flattenTheme(theme: Readonly<Record<string, unknown>>, bases: readonly BaseEntry[]): FlattenResult {
  // Flattening resolves the chain (chapter 15); it does not require the child itself to be valid.
  if (theme.extends === undefined) {
    const { extends: _e, ...rest } = theme;
    return { ok: true, document: rest, lineage: [], diagnostics: [] };
  }
  const c = new DiagnosticCollector("theme");
  const chain = resolveChain(theme, { bases }, c);
  if (!chain) return { ok: false, document: { ...theme }, lineage: [], diagnostics: c.finish() };
  const merged = mergeChain(chain.chain);
  delete merged.extends;
  const lineage = chain.chain.slice(0, -1).map((d) => ({ id: String(d.id), version: String(d.version) }));
  const provenance = isRecord(merged.provenance) ? { ...merged.provenance } : {};
  const prior = Array.isArray(provenance.lineage) ? (provenance.lineage as { id: string; version: string }[]) : [];
  provenance.lineage = [...prior, ...lineage];
  merged.provenance = provenance;
  return { ok: true, document: merged, lineage: provenance.lineage as { id: string; version: string }[], diagnostics: c.finish() };
}

/** Export eligibility: author, license, and integrity must all be present (OT-META-008). */
export function exportCheck(theme: Readonly<Record<string, unknown>>): { eligible: boolean; diagnostics: Diagnostic[] } {
  const missing = ["author", "license", "integrity"].filter((k) => theme[k] === undefined);
  const c = new DiagnosticCollector("theme");
  if (missing.length > 0) c.add("OT-META-008", { document: "theme", pointer: "/" }, { params: { detail: missing } });
  return { eligible: missing.length === 0, diagnostics: c.finish() };
}
