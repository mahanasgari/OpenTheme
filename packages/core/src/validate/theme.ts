/**
 * Theme validation (chapter 13, "Validation procedure").
 */
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";
import { BASELINE, CATALOG, type Contract, limit } from "../engine/registry.js";
import { JsonParseError, parseIJson } from "../parse/ijson.js";
import { reportSchema, themeSchemaFindings } from "./schema.js";
import {
  validateComponents,
  validateContexts,
  validateCustomization,
  validateDerivations,
  validateLayout,
  validateLimits,
  validateSeeds,
} from "./semantic.js";
import { validateTokenTree } from "./tokens.js";
import { checkAccessibility } from "./accessibility.js";
import { deepFreeze } from "../registry/snapshot.js";
import { Prepared } from "../resolve/prepare.js";

export type Trust = "trusted" | "untrusted";

export interface BaseEntry {
  readonly trust: Trust;
  readonly document: Readonly<Record<string, unknown>>;
}

export interface ValidateOptions {
  readonly bases?: readonly BaseEntry[];
  readonly host?: Readonly<Record<string, unknown>> | null;
  /** Reuse of pure results for frozen inputs (per Core, bounded). */
  readonly prepared?: Prepared;
}

export interface ThemeValidation {
  readonly valid: boolean;
  readonly unsupported: boolean;
  readonly diagnostics: Diagnostic[];
  /** The parsed document (when it parsed as an object). */
  readonly document?: Readonly<Record<string, unknown>>;
  /** The inheritance-merged document (when inheritance succeeded). */
  readonly merged?: Readonly<Record<string, unknown>>;
  /** Lowest trust along the resolved chain, excluding the document's own entry trust. */
  readonly chainTrust?: Trust;
}

export const SUPPORTED_SPEC = "1.0";

export function hostContracts(host: Readonly<Record<string, unknown>> | null | undefined): Map<string, Contract> {
  const map = new Map<string, Contract>(CATALOG.map((c) => [c.id, c]));
  if (host && Array.isArray(host.contracts)) {
    for (const c of host.contracts as Contract[]) if (isRecord(c) && typeof c.id === "string") map.set(c.id, c);
  }
  return map;
}

export function hostTokenTypes(host: Readonly<Record<string, unknown>> | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!host || typeof host.id !== "string" || !isRecord(host.tokens)) return out;
  const walk = (node: Record<string, unknown>, parts: string[], inherited: string | undefined) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$") || !isRecord(v)) continue;
      const type = typeof v.$type === "string" ? v.$type : inherited;
      if ("$value" in v || "$derive" in v) out.set(`${host.id}/${[...parts, k].join(".")}`, type ?? "color");
      else walk(v, [...parts, k], type);
    }
  };
  walk(host.tokens, [], undefined);
  return out;
}

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Exact version, or caret ^M.m.p: same major, and (minor, patch) at least the required. */
export function versionSatisfies(required: string, actual: string): boolean {
  if (required === actual) return true;
  if (!required.startsWith("^")) return false;
  const want = parseVersion(required.slice(1));
  const have = parseVersion(actual);
  if (!want || !have || want[0] !== have[0]) return false;
  if (have[1] !== want[1]) return have[1] > want[1];
  return have[2] >= want[2];
}

function mergeDeep(a: unknown, b: unknown): unknown {
  if (isRecord(a) && isRecord(b)) {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? mergeDeep(out[k], v) : v;
    return out;
  }
  return b;
}

function isTokenLeaf(v: unknown): boolean {
  return isRecord(v) && ("$value" in v || "$derive" in v);
}

function mergeTokens(a: unknown, b: unknown): unknown {
  if (isRecord(a) && isRecord(b) && !isTokenLeaf(b)) {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? mergeTokens(out[k], v) : v;
    return out;
  }
  return b;
}

/** Base-first merge (data model §10): child values, overlays per identical `when`, styling, points. */
export function mergeChain(chain: readonly Readonly<Record<string, unknown>>[]): Record<string, unknown> {
  let acc: Record<string, unknown> = {};
  for (const doc of chain) {
    const next: Record<string, unknown> = { ...acc };
    for (const [key, value] of Object.entries(doc)) {
      if (key === "extends") continue;
      if (key === "tokens") next.tokens = mergeTokens(acc.tokens, value);
      else if (key === "contexts" && Array.isArray(value) && Array.isArray(acc.contexts)) {
        const byWhen = new Map<string, Record<string, unknown>>();
        const order: string[] = [];
        for (const o of [...(acc.contexts as Record<string, unknown>[]), ...(value as Record<string, unknown>[])]) {
          const k = JSON.stringify(Object.entries(isRecord(o.when) ? o.when : {}).sort());
          if (!byWhen.has(k)) order.push(k);
          const prev = byWhen.get(k);
          byWhen.set(k, prev ? (mergeDeep(prev, o) as Record<string, unknown>) : o);
        }
        next.contexts = order.map((k) => byWhen.get(k)!);
      } else if (key === "components" || key === "seeds" || key === "layout") {
        next[key] = mergeDeep(acc[key], value);
      } else if (key === "customization" && isRecord(value) && isRecord(acc.customization)) {
        const points = new Map<string, Record<string, unknown>>();
        for (const p of [
          ...((acc.customization.points as Record<string, unknown>[]) ?? []),
          ...((value.points as Record<string, unknown>[]) ?? []),
        ]) {
          const id = String(p.id);
          points.set(id, points.has(id) ? { ...points.get(id)!, ...p } : p);
        }
        next.customization = { ...acc.customization, ...value, points: [...points.values()] };
      } else {
        next[key] = value;
      }
    }
    acc = next;
  }
  if (chain.length > 0 && chain[chain.length - 1]!.extends !== undefined) acc.extends = chain[chain.length - 1]!.extends;
  return acc;
}

interface ChainResult {
  readonly chain: Readonly<Record<string, unknown>>[];
  readonly trust: Trust;
}

/**
 * Chapter 10: walk the whole `extends` chain first (depth, cycles, missing bases, versions), then
 * validate the nearest base with the same supplied bases. A valid nearest base implies a valid
 * chain, because its own validation covers its bases. Every finding is located at
 * `base:<id>@<version>` as the `extends` member that reached it is written.
 */
export function resolveChain(doc: Readonly<Record<string, unknown>>, options: ValidateOptions, c: DiagnosticCollector): ChainResult | null {
  const bases = options.bases ?? [];
  const links: { readonly where: string; readonly match: (typeof bases)[number] }[] = [];
  const ids = new Set<string>([String(doc.id)]);
  let current = doc;
  for (let depth = 1; ; depth += 1) {
    const ext = current.extends;
    if (!isRecord(ext) || typeof ext.id !== "string" || typeof ext.version !== "string") break;
    const where = `base:${ext.id}@${ext.version}`;
    if (depth > limit("inheritanceDepth")) {
      c.add("OT-INH-005", { document: where, pointer: "/extends" });
      return null;
    }
    if (ids.has(ext.id)) {
      c.add("OT-INH-004", { document: where, pointer: "/extends" });
      return null;
    }
    const candidates = bases.filter((b) => b.document.id === ext.id);
    if (candidates.length === 0) {
      c.add("OT-INH-001", { document: where, pointer: "/extends" });
      return null;
    }
    const match = candidates.find((b) => versionSatisfies(ext.version as string, String(b.document.version)));
    if (!match) {
      c.add("OT-INH-003", { document: where, pointer: "/extends/version" });
      return null;
    }
    ids.add(ext.id);
    links.push({ where, match });
    current = match.document;
  }
  const nearest = links[0];
  if (nearest) {
    const baseResult = validateThemeDocument(nearest.match.document, { ...options, bases });
    if (!baseResult.valid) {
      const errors = baseResult.diagnostics.filter((d) => d.severity === "error");
      if (errors.length === 0) c.add("OT-INH-002", { document: nearest.where, pointer: "/" });
      for (const d of errors) {
        // A finding already located in a farther base is reported as it is.
        if (d.location.document.startsWith("base:")) c.addAll([d]);
        else c.add("OT-INH-002", { document: nearest.where, pointer: d.location.pointer });
      }
      return null;
    }
  }
  let trust: Trust = "trusted";
  const chain: Readonly<Record<string, unknown>>[] = [doc];
  for (const { match } of links) {
    if (match.trust !== "trusted") trust = "untrusted";
    chain.unshift(match.document);
  }
  return { chain, trust };
}

/** Validate theme bytes or an already-parsed value. */
export function validateTheme(input: string | Uint8Array | unknown, options: ValidateOptions = {}): ThemeValidation {
  const c = new DiagnosticCollector("theme");
  let value: unknown = input;
  if (typeof input === "string" || input instanceof Uint8Array) {
    try {
      value = parseIJson(input, { maxBytes: limit("documentBytes"), maxDepth: limit("nestingDepth") });
    } catch (e) {
      if (!(e instanceof JsonParseError)) throw e;
      const code = { bytes: "OT-LIM-001", depth: "OT-LIM-002", syntax: "OT-DOC-001", duplicate: "OT-DOC-002" }[e.failure];
      c.add(code, { document: "theme", pointer: e.failure === "duplicate" ? e.pointer : "/" });
      return { valid: false, unsupported: false, diagnostics: c.finish() };
    }
  }
  if (!isRecord(value)) {
    c.add("OT-DOC-001", { document: "theme", pointer: "/" });
    return { valid: false, unsupported: false, diagnostics: c.finish() };
  }
  return validateDocumentInto(value, options, c);
}

/**
 * Validation is a pure function of the document, the host declaration, and, for a theme that
 * inherits, the ordered bases with their trust. With `options.prepared`, results for frozen
 * inputs are reused (FR-C041, FR-C071); anything unfrozen is validated afresh.
 */
export function validateThemeDocument(doc: Readonly<Record<string, unknown>>, options: ValidateOptions = {}): ThemeValidation {
  const prepared = options.prepared;
  const key = prepared ? Prepared.key(doc, options.host ?? null, options.bases) : null;
  if (!prepared || key === null) return validateDocumentInto(doc, options, new DiagnosticCollector("theme"));
  const hit = prepared.validations.get(key) as ThemeValidation | undefined;
  if (hit) return hit;
  const result = deepFreeze(validateDocumentInto(doc, options, new DiagnosticCollector("theme")));
  prepared.validations.set(key, result);
  return result;
}

function validateDocumentInto(
  doc: Readonly<Record<string, unknown>>,
  options: ValidateOptions,
  c: DiagnosticCollector,
): ThemeValidation {
  reportSchema(c, "theme", themeSchemaFindings(doc));
  // Version gate (chapter 02, chapter 14).
  const version = doc.opentheme;
  if (typeof version !== "string") {
    return { valid: false, unsupported: false, diagnostics: c.finish(), document: doc };
  }
  if (version !== SUPPORTED_SPEC) {
    const major = version.split(".")[0];
    c.add(major === SUPPORTED_SPEC.split(".")[0] ? "OT-VER-002" : "OT-VER-001", { document: "theme", pointer: "/opentheme" });
    return { valid: false, unsupported: true, diagnostics: c.finish(), document: doc };
  }
  let working: Readonly<Record<string, unknown>> = doc;
  let chainTrust: Trust = "trusted";
  if (doc.extends !== undefined) {
    const chain = resolveChain(doc, options, c);
    if (!chain) return { valid: false, unsupported: false, diagnostics: c.finish(), document: doc };
    working = mergeChain(chain.chain);
    chainTrust = chain.trust;
  }
  const host = options.host ?? null;
  validateSeeds(working as Record<string, unknown>, c);
  const { nodes } = validateTokenTree(working as Record<string, unknown>, c, hostTokenTypes(host));
  validateDerivations(working as Record<string, unknown>, nodes, c);
  const declared = new Set<string>([...BASELINE.keys()]);
  let tokenCount = 0;
  for (const n of nodes.values()) {
    if (!n.external) {
      declared.add(n.path);
      tokenCount += 1;
    }
  }
  validateContexts(working as Record<string, unknown>, declared, c);
  validateComponents(working as Record<string, unknown>, hostContracts(host), c, host !== null);
  validateCustomization(working as Record<string, unknown>, declared, c);
  if (!c.hasError()) checkAccessibility(working, host, c, options.prepared);
  validateLimits(working as Record<string, unknown>, tokenCount, c);
  validateLayout(working as Record<string, unknown>, c);
  const diagnostics = c.finish();
  return {
    valid: !diagnostics.some((d) => d.severity === "error"),
    unsupported: false,
    diagnostics,
    document: doc,
    merged: working,
    chainTrust,
  };
}
