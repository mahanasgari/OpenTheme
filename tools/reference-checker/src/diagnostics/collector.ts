import { requireDiagnosticCode, type Severity } from "./registry.js";

export type DocumentKind =
  | "theme"
  | `base:${string}@${string}`
  | "host"
  | "input"
  | "preferences";

export interface Location {
  document: DocumentKind | string;
  pointer: string;
}

export type ParamValue = string | number | boolean | string[];

export interface Diagnostic {
  code: string;
  severity: Severity;
  location: Location;
  rule: string;
  message: string;
  hint: string;
  params: Record<string, ParamValue>;
  related?: Location[];
}

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const DOCUMENT_ORDER = (document: string): number => {
  if (document === "theme") return 0;
  if (document.startsWith("base:")) return 1;
  if (document === "host") return 2;
  if (document === "input") return 3;
  if (document === "preferences") return 4;
  return 5;
};

function isAllowedParam(value: unknown): value is ParamValue {
  if (typeof value === "string") return true;
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return true;
  }
  return false;
}

export class ParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}

export interface CollectorOptions {
  cap?: number;
}

export class DiagnosticCollector {
  readonly #items: Diagnostic[] = [];
  readonly #cap: number;

  constructor(options: CollectorOptions = {}) {
    this.#cap = options.cap ?? 200;
  }

  add(input: {
    code: string;
    location: Location;
    rule: string;
    params?: Record<string, unknown>;
    related?: Location[];
    severity?: Severity;
  }): void {
    const entry = requireDiagnosticCode(input.code);
    const params: Record<string, ParamValue> = {};
    for (const [key, value] of Object.entries(input.params ?? {})) {
      if (!isAllowedParam(value)) {
        throw new ParamError(
          `Diagnostic param '${key}' has a disallowed kind`,
        );
      }
      params[key] = value;
    }

    const diagnostic: Diagnostic = {
      code: input.code,
      severity: input.severity ?? entry.severity,
      location: input.location,
      rule: input.rule,
      message: entry.message,
      hint: entry.hint,
      params,
    };
    if (input.related && input.related.length > 0) {
      diagnostic.related = input.related;
    }

    // Deduplicate identical (code, document, pointer) — schema + semantic overlap.
    const key = `${diagnostic.code}|${diagnostic.location.document}|${diagnostic.location.pointer}`;
    if (this.#items.some((d) => `${d.code}|${d.location.document}|${d.location.pointer}` === key)) {
      return;
    }
    // Prefer LIM-006 over TOK-001 for the same over-long path/segment.
    if (
      diagnostic.code === "OT-TOK-001" &&
      this.#items.some(
        (d) =>
          d.code === "OT-LIM-006" &&
          d.location.document === diagnostic.location.document &&
          d.location.pointer === diagnostic.location.pointer,
      )
    ) {
      return;
    }

    // Every finding is kept until finish(), which orders them and then applies the cap (chapter 13).
    this.#items.push(diagnostic);
  }

  /** Whether an error-severity diagnostic has been reported. */
  hasError(): boolean {
    return this.#items.some((d) => d.severity === "error");
  }

  finish(): Diagnostic[] {
    const sorted = [...this.#items].sort((a, b) => {
      const doc =
        DOCUMENT_ORDER(a.location.document) -
        DOCUMENT_ORDER(b.location.document);
      if (doc !== 0) return doc;
      // Bases: nearest to farthest — keep insertion order within base:* by not
      // reordering different base documents beyond the shared rank; stable sort
      // preserves relative order for equal document ranks of different bases.
      if (
        a.location.document.startsWith("base:") &&
        b.location.document.startsWith("base:") &&
        a.location.document !== b.location.document
      ) {
        return 0;
      }
      // Chapter 13: UTF-16 code-unit order (as JCS orders member names), never locale order (F13).
      const pointer = codeUnitCompare(a.location.pointer, b.location.pointer);
      if (pointer !== 0) return pointer;
      return codeUnitCompare(a.code, b.code);
    });

    if (sorted.length > this.#cap) {
      const omitted = sorted.length - this.#cap;
      sorted.length = this.#cap;
      const lim = requireDiagnosticCode("OT-LIM-099");
      sorted.push({
        code: "OT-LIM-099",
        severity: lim.severity,
        location: { document: "theme", pointer: "" },
        rule: "R-LIM-099",
        message: lim.message,
        hint: lim.hint,
        params: { omitted },
      });
    }
    return sorted;
  }
}
