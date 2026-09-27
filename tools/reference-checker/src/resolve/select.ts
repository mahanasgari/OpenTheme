import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeIntegrity } from "../canonical/integrity.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { compareSelectionOrder } from "../versioning/semver.js";
import { validateThemeObject } from "../validate/document.js";
import {
  mergeThemeDocuments,
  resolveInheritanceChain,
  type ThemeWithTrust,
} from "../validate/inheritance.js";

export type FallbackKind =
  | "none"
  | "previous"
  | "developer-default"
  | "specification-baseline";

export type TrustLevel = "trusted" | "untrusted";

export interface ThemeEntry {
  trust?: TrustLevel;
  document: Record<string, unknown>;
}

export interface SelectInput {
  themes?: ThemeEntry[];
  /** Convenience: single theme document (tests / CLI). */
  theme?: Record<string, unknown>;
  selection: { id: string; version?: string };
  previous?: { id: string; version: string } | null;
  policy?: {
    availableThemes?: string[];
    defaultTheme?: string;
  };
  /** Host declaration — enables host-qualified reference validation. */
  host?: Record<string, unknown> | null;
}

export interface SelectResult {
  document: Record<string, unknown>;
  fallback: FallbackKind;
  id: string;
  version: string;
  /** Lowest trust in the selected theme's inheritance chain (FR-048). */
  trust: TrustLevel;
}

const BASELINE_ID = "org.opentheme.baseline";

let baselineDoc: Record<string, unknown> | undefined;

export function loadSpecificationBaseline(): Record<string, unknown> {
  if (baselineDoc) return baselineDoc;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/themes/baseline/org.opentheme.baseline.opentheme.json",
  );
  baselineDoc = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  return baselineDoc;
}

function themeId(doc: Record<string, unknown>): string {
  return String(doc.id ?? "");
}

function themeVersion(doc: Record<string, unknown>): string {
  return String(doc.version ?? "0.0.0");
}

/** Fail closed: only an explicit host-supplied `trusted` grants trust (FR-010). */
function entryTrust(e: ThemeEntry): TrustLevel {
  return e.trust === "trusted" ? "trusted" : "untrusted";
}

function minTrust(a: TrustLevel, b: TrustLevel): TrustLevel {
  return a === "untrusted" || b === "untrusted" ? "untrusted" : "trusted";
}

function integrityConflict(entries: ThemeEntry[]): boolean {
  if (entries.length <= 1) return false;
  const hashes = new Set(
    entries.map((e) => computeIntegrity(e.document).integrity),
  );
  return hashes.size > 1;
}

function prepareDocument(
  entry: ThemeEntry,
  all: ThemeWithTrust[],
  collector: DiagnosticCollector,
  host?: Record<string, unknown> | null,
): { document: Record<string, unknown>; valid: boolean; trust: TrustLevel } {
  const bases = all.filter((t) => t.document !== entry.document);
  const result = validateThemeObject(entry.document, {
    bases,
    ...(host ? { host } : {}),
  });
  for (const d of result.diagnostics) {
    collector.add({
      code: d.code,
      rule: d.rule,
      location: d.location,
      params: d.params,
      ...(d.related ? { related: d.related } : {}),
      ...(d.severity ? { severity: d.severity } : {}),
    });
  }
  if (!result.valid) {
    return {
      document: entry.document,
      valid: false,
      trust: entryTrust(entry),
    };
  }
  let trust = entryTrust(entry);
  if (entry.document.extends !== undefined) {
    const inherited = resolveInheritanceChain(entry.document, bases, collector);
    if (!inherited) {
      return { document: entry.document, valid: false, trust };
    }
    trust = minTrust(trust, inherited.trust);
    return {
      document: mergeThemeDocuments(inherited.chain, entry.document),
      valid: true,
      trust,
    };
  }
  return { document: entry.document, valid: true, trust };
}

/**
 * Select a theme document with fallback:
 * selected → previous → developer default → specification baseline.
 */
export function selectTheme(
  input: SelectInput,
  collector: DiagnosticCollector,
): SelectResult {
  const available = new Set(input.policy?.availableThemes ?? []);
  // Trust is normalized per document entry, and trusted entries are registered first, so an
  // untrusted entry can never shadow or deny a trusted one regardless of input order
  // (FR-068, NFR-001).
  const supplied: ThemeEntry[] = (input.themes ?? []).map((e) => ({
    trust: entryTrust(e),
    document: e.document,
  }));
  const entries: ThemeEntry[] = supplied.filter((e) => e.trust === "trusted");
  if (input.theme) {
    // `theme` is shorthand for one trusted `themes` entry.
    entries.push({ trust: "trusted", document: input.theme });
  }

  // Always offer the specification baseline (FB-013). Only a trusted entry may stand in for it.
  const baseline = loadSpecificationBaseline();
  if (!entries.some((e) => themeId(e.document) === BASELINE_ID)) {
    entries.push({ trust: "trusted", document: baseline });
  }
  entries.push(...supplied.filter((e) => e.trust === "untrusted"));
  available.add(BASELINE_ID);

  const byId = new Map<string, ThemeEntry[]>();
  /** id@version keys with integrity conflicts — selection must refuse them. */
  const conflicting = new Set<string>();

  for (const e of entries) {
    const id = themeId(e.document);
    if (!id) continue;
    const list = byId.get(id) ?? [];
    const existingTrusted = list.find((x) => x.trust === "trusted");
    if (existingTrusted && e.trust === "untrusted") {
      collector.add({
        code: "OT-SEC-001",
        rule: "R-SEC-001",
        location: { document: "input", pointer: "/themes" },
        params: { detail: id },
        severity: "warning",
      });
      continue;
    }
    const ver = themeVersion(e.document);
    const sameVer = list.filter((x) => themeVersion(x.document) === ver);
    if (sameVer.length > 0) {
      const incoming = computeIntegrity(e.document).integrity;
      for (const prior of sameVer) {
        const priorHash = computeIntegrity(prior.document).integrity;
        if (priorHash !== incoming) {
          collector.add({
            code: "OT-SEC-002",
            rule: "R-SEC-002",
            location: { document: "input", pointer: "/themes" },
            params: { detail: `${id}@${ver}` },
            severity: "warning",
          });
          conflicting.add(`${id}@${ver}`);
          break;
        }
      }
    }
    // Keep both entries distinct (do not overwrite)
    list.push(e);
    byId.set(id, list);
    if (integrityConflict(list.filter((x) => themeVersion(x.document) === ver))) {
      conflicting.add(`${id}@${ver}`);
    }
  }

  const allTrust: ThemeWithTrust[] = [...byId.values()].flat();

  const pickEntry = (
    id: string,
    version?: string,
  ): ThemeEntry | undefined => {
    const list = byId.get(id);
    if (!list || list.length === 0) return undefined;
    if (version) {
      const key = `${id}@${version}`;
      if (conflicting.has(key)) return undefined; // fail closed (SEC-002)
      const matches = list.filter((e) => themeVersion(e.document) === version);
      if (matches.length === 0) return undefined;
      if (integrityConflict(matches)) return undefined;
      return matches[0];
    }
    // Unversioned (R-RES-005): highest SemVer precedence among non-conflicted candidates,
    // independent of input order.
    let best: ThemeEntry | undefined;
    for (const e of list) {
      const ver = themeVersion(e.document);
      if (conflicting.has(`${id}@${ver}`)) continue;
      const same = list.filter((x) => themeVersion(x.document) === ver);
      if (integrityConflict(same)) continue;
      if (!best || compareSelectionOrder(ver, themeVersion(best.document)) > 0) best = e;
    }
    return best;
  };

  const tryId = (
    id: string | undefined,
    fallback: FallbackKind,
    code?: string,
    version?: string,
  ): SelectResult | null => {
    if (!id) return null;
    if (available.size > 0 && !available.has(id) && id !== BASELINE_ID) {
      return null;
    }
    const entry = pickEntry(id, version);
    if (!entry) return null;
    const prepared = prepareDocument(entry, allTrust, collector, input.host);
    if (!prepared.valid) return null;
    if (code) {
      collector.add({
        code,
        rule: code.replace(/^OT-/, "R-"),
        location: { document: "input", pointer: "/selection" },
        params: { detail: id },
        severity: "warning",
      });
    }
    return {
      document: prepared.document,
      fallback,
      id: themeId(entry.document),
      version: themeVersion(entry.document),
      trust: prepared.trust,
    };
  };

  const selected = tryId(
    input.selection.id,
    "none",
    undefined,
    input.selection.version,
  );
  if (selected) return selected;

  const prev = tryId(
    input.previous?.id,
    "previous",
    "OT-RES-001",
    input.previous?.version,
  );
  if (prev) return prev;

  const def = tryId(
    input.policy?.defaultTheme,
    "developer-default",
    "OT-RES-002",
  );
  if (def) return def;

  const base = tryId(BASELINE_ID, "specification-baseline", "OT-RES-003");
  if (base) return base;

  return {
    document: baseline,
    fallback: "specification-baseline",
    id: BASELINE_ID,
    version: themeVersion(baseline),
    trust: "trusted",
  };
}
