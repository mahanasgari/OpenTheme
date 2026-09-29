/**
 * Stage 1, selection (chapter 10 "Selection, trust, and fallback"; chapter 12; R-RES-005).
 */
import { computeIntegrity } from "../canonical/integrity.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";
import { baselineTheme } from "../generated/baseline.js";
import { type BaseEntry, type Trust, validateThemeDocument } from "../validate/theme.js";
import { compareSelectionOrder } from "../versioning/semver.js";
import type { Prepared } from "./prepare.js";

export const BASELINE_ID = "org.opentheme.baseline";

export type Fallback = "none" | "previous" | "developer-default" | "specification-baseline";

export interface ThemeEntry {
  readonly trust: Trust;
  readonly document: Readonly<Record<string, unknown>>;
}

export interface Selected {
  readonly entry: ThemeEntry;
  readonly merged: Readonly<Record<string, unknown>>;
  readonly fallback: Fallback;
  readonly trust: Trust;
}

export interface SelectInput {
  readonly themes: readonly ThemeEntry[];
  readonly selection: { readonly id: string; readonly version?: string };
  readonly previous: { readonly id: string; readonly version: string } | null;
  readonly availableThemes?: readonly string[];
  readonly defaultTheme?: string;
  readonly host: Readonly<Record<string, unknown>> | null;
}

const id = (d: Readonly<Record<string, unknown>>) => String(d.id ?? "");
const ver = (d: Readonly<Record<string, unknown>>) => String(d.version ?? "0.0.0");

export function selectTheme(input: SelectInput, c: DiagnosticCollector, prepared?: Prepared): Selected {
  const baseline = baselineTheme as Record<string, unknown>;
  // Trusted entries (then the built-in baseline) are registered before untrusted ones (F1).
  const trusted = input.themes.filter((e) => e.trust === "trusted");
  const ordered: ThemeEntry[] = [...trusted];
  if (!trusted.some((e) => id(e.document) === BASELINE_ID)) ordered.push({ trust: "trusted", document: baseline });
  ordered.push(...input.themes.filter((e) => e.trust !== "trusted"));

  const byId = new Map<string, ThemeEntry[]>();
  const conflicting = new Set<string>();
  for (const e of ordered) {
    const eid = id(e.document);
    if (!eid) continue;
    const list = byId.get(eid) ?? [];
    if (e.trust !== "trusted" && list.some((x) => x.trust === "trusted")) {
      c.add("OT-SEC-001", { document: "input", pointer: "/themes" }, { params: { detail: eid } });
      continue;
    }
    const same = list.filter((x) => ver(x.document) === ver(e.document));
    if (same.length > 0) {
      const incoming = computeIntegrity(e.document).integrity;
      if (same.some((x) => computeIntegrity(x.document).integrity !== incoming)) {
        c.add("OT-SEC-002", { document: "input", pointer: "/themes" }, { params: { detail: `${eid}@${ver(e.document)}` } });
        conflicting.add(`${eid}@${ver(e.document)}`);
      }
    }
    list.push(e);
    byId.set(eid, list);
  }
  const all: BaseEntry[] = [...byId.values()].flat();
  const available = new Set(input.availableThemes ?? []);
  available.add(BASELINE_ID);

  const pick = (tid: string, version?: string): ThemeEntry | undefined => {
    const list = byId.get(tid);
    if (!list) return undefined;
    if (version) {
      if (conflicting.has(`${tid}@${version}`)) return undefined;
      return list.find((e) => ver(e.document) === version);
    }
    let best: ThemeEntry | undefined;
    for (const e of list) {
      if (conflicting.has(`${tid}@${ver(e.document)}`)) continue;
      if (!best || compareSelectionOrder(ver(e.document), ver(best.document)) > 0) best = e;
    }
    return best;
  };

  const attempt = (tid: string | undefined, fallback: Fallback, code?: string, version?: string): Selected | null => {
    if (!tid) return null;
    if (input.availableThemes && input.availableThemes.length > 0 && !available.has(tid)) return null;
    const entry = pick(tid, version);
    if (!entry) return null;
    const v = validateThemeDocument(entry.document, {
      bases: all.filter((b) => b.document !== entry.document),
      host: input.host,
      ...(prepared ? { prepared } : {}),
    });
    c.addAll(v.diagnostics);
    if (!v.valid || !v.merged) return null;
    if (code) c.add(code, { document: "input", pointer: "/selection" }, { params: { detail: tid } });
    const trust: Trust = entry.trust === "trusted" && v.chainTrust === "trusted" ? "trusted" : "untrusted";
    return { entry, merged: v.merged, fallback, trust };
  };

  // A supplied theme that the policy excludes is reported, then falls back (chapter 10).
  const sel = input.selection.id;
  if (input.availableThemes && input.availableThemes.length > 0 && sel && byId.has(sel) && !available.has(sel)) {
    c.add("OT-RES-004", { document: "input", pointer: "/selection" }, { params: { detail: input.selection.id } });
  }
  return (
    attempt(input.selection.id, "none", undefined, input.selection.version) ??
    attempt(input.previous?.id, "previous", "OT-RES-001", input.previous?.version) ??
    attempt(input.defaultTheme, "developer-default", "OT-RES-002") ??
    attempt(BASELINE_ID, "specification-baseline", "OT-RES-003") ?? {
      entry: { trust: "trusted", document: baseline },
      merged: baseline,
      fallback: "specification-baseline",
      trust: "trusted",
    }
  );
}

export { isRecord };
