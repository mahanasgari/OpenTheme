/**
 * Diagnostics (chapter 13; diagnostic.schema.json). Codes come only from the registry.
 * Order: document (theme, bases nearest→farthest, host, input, preferences), then pointer in
 * UTF-16 code-unit order, then code. At most 200 entries, then OT-LIM-099.
 */
import { diagnosticCodes } from "../generated/registries.js";

export type Severity = "error" | "warning" | "info";
export type ParamValue = string | number | boolean | readonly string[];

export interface DiagnosticLocation {
  readonly document: string;
  readonly pointer: string;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: Severity;
  readonly location: DiagnosticLocation;
  readonly rule: string;
  readonly message: string;
  readonly hint: string;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly related?: readonly DiagnosticLocation[];
}

export const DIAGNOSTIC_CAP = 200;

function documentRank(doc: string): number {
  if (doc === "theme") return 0;
  if (doc.startsWith("base:")) return 1;
  if (doc === "host") return 2;
  if (doc === "input") return 3;
  if (doc === "preferences") return 4;
  return 5;
}

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isParamValue(v: unknown): v is ParamValue {
  if (typeof v === "string" || typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function jsonPointer(segments: readonly (string | number)[]): string {
  if (segments.length === 0) return "";
  return `/${segments.map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
}

export class DiagnosticCollector {
  readonly #items: Diagnostic[] = [];
  readonly #keys = new Set<string>();
  readonly #capDocument: string;

  constructor(capDocument = "theme") {
    this.#capDocument = capDocument;
  }

  add(
    code: string,
    location: DiagnosticLocation,
    options: { params?: Record<string, unknown>; severity?: Severity; related?: DiagnosticLocation[] } = {},
  ): void {
    const entry = diagnosticCodes[code];
    if (!entry) throw new Error(`unregistered diagnostic code ${code}`);
    // Identical (code, location) findings carry no extra information (finding F17).
    const key = `${code}\u0000${location.document}\u0000${location.pointer}`;
    if (this.#keys.has(key)) return;
    this.#keys.add(key);
    const params: Record<string, ParamValue> = {};
    for (const [k, v] of Object.entries(options.params ?? {})) {
      if (!isParamValue(v)) throw new Error(`diagnostic param ${k} has a disallowed kind`);
      params[k] = v;
    }
    this.#items.push({
      code,
      severity: options.severity ?? entry.severity,
      location,
      rule: entry.rule,
      message: entry.message,
      hint: entry.hint,
      params,
      ...(options.related && options.related.length > 0 ? { related: options.related } : {}),
    });
  }

  addAll(diagnostics: readonly Diagnostic[]): void {
    for (const d of diagnostics) {
      const key = `${d.code}\u0000${d.location.document}\u0000${d.location.pointer}`;
      if (this.#keys.has(key)) continue;
      this.#keys.add(key);
      this.#items.push(d);
    }
  }

  hasError(): boolean {
    return this.#items.some((d) => d.severity === "error");
  }

  get size(): number {
    return this.#items.length;
  }

  finish(): Diagnostic[] {
    const sorted = this.#items
      .map((d, index) => ({ d, index }))
      .sort((a, b) => {
        const ra = documentRank(a.d.location.document);
        const rb = documentRank(b.d.location.document);
        if (ra !== rb) return ra - rb;
        // Different base documents keep insertion order (nearest base first).
        if (ra === 1 && a.d.location.document !== b.d.location.document) return a.index - b.index;
        const p = codeUnitCompare(a.d.location.pointer, b.d.location.pointer);
        if (p !== 0) return p;
        const c = codeUnitCompare(a.d.code, b.d.code);
        return c !== 0 ? c : a.index - b.index;
      })
      .map((x) => x.d);
    if (sorted.length <= DIAGNOSTIC_CAP) return sorted;
    const kept = sorted.slice(0, DIAGNOSTIC_CAP);
    const lim = diagnosticCodes["OT-LIM-099"]!;
    kept.push({
      code: "OT-LIM-099",
      severity: lim.severity,
      location: { document: this.#capDocument, pointer: "" },
      rule: lim.rule,
      message: lim.message,
      hint: lim.hint,
      params: { omitted: sorted.length - DIAGNOSTIC_CAP },
    });
    return kept;
  }
}
