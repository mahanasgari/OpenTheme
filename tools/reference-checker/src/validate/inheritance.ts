/**
 * Theme inheritance: extends lookup, caret matching, depth, cycles (OT-INH-*).
 */
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { validateThemeObject } from "./document.js";

export interface ExtendsRef {
  id: string;
  version: string;
}

export interface ThemeWithTrust {
  trust?: "trusted" | "untrusted";
  document: Record<string, unknown>;
}

const MAX_INHERITANCE_DEPTH = 4;

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Exact match or caret ^M.m.p (same major, minor.patch >=). */
export function versionSatisfies(required: string, actual: string): boolean {
  if (required === actual) return true;
  if (required.startsWith("^")) {
    const want = parseVersion(required.slice(1));
    const have = parseVersion(actual);
    if (!want || !have) return false;
    if (want[0] !== have[0]) return false;
    if (have[1] !== want[1]) return have[1] > want[1];
    return have[2] >= want[2];
  }
  return false;
}

function themeId(doc: Record<string, unknown>): string {
  return String(doc.id ?? "");
}

function themeVersion(doc: Record<string, unknown>): string {
  return String(doc.version ?? "");
}

function extendsOf(doc: Record<string, unknown>): ExtendsRef | null {
  const ext = doc.extends;
  if (!ext || typeof ext !== "object" || Array.isArray(ext)) return null;
  const e = ext as { id?: unknown; version?: unknown };
  if (typeof e.id !== "string" || typeof e.version !== "string") return null;
  return { id: e.id, version: e.version };
}

/**
 * Resolve inheritance chain for `doc` among `available` bases.
 * Returns ordered bases from root to parent (nearest base last before child),
 * or null if inheritance is invalid (diagnostics already emitted).
 */
export function resolveInheritanceChain(
  doc: Record<string, unknown>,
  available: ThemeWithTrust[],
  collector: DiagnosticCollector,
): { chain: Record<string, unknown>[]; trust: "trusted" | "untrusted" } | null {
  const byId = new Map<string, ThemeWithTrust[]>();
  for (const t of available) {
    const id = themeId(t.document);
    const list = byId.get(id) ?? [];
    list.push(t);
    byId.set(id, list);
  }

  const chain: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let current: Record<string, unknown> | null = doc;
  let trust: "trusted" | "untrusted" = "trusted";
  let depth = 0;

  while (current) {
    const ext = extendsOf(current);
    if (!ext) break;
    depth += 1;
    if (depth > MAX_INHERITANCE_DEPTH) {
      collector.add({
        code: "OT-INH-005",
        rule: "R-INH-005",
        location: { document: "theme", pointer: "/extends" },
        params: { detail: String(depth) },
      });
      return null;
    }

    const key = `${ext.id}@${ext.version}`;
    if (seen.has(ext.id) || themeId(current) === ext.id) {
      collector.add({
        code: "OT-INH-004",
        rule: "R-INH-004",
        location: {
          document: `base:${ext.id}@${ext.version}`,
          pointer: "/extends",
        },
        params: { detail: ext.id },
      });
      return null;
    }
    seen.add(ext.id);

    const candidates = byId.get(ext.id) ?? [];
    const match = candidates.find((c) =>
      versionSatisfies(ext.version, themeVersion(c.document)),
    );
    if (candidates.length === 0) {
      collector.add({
        code: "OT-INH-001",
        rule: "R-INH-001",
        location: {
          document: `base:${ext.id}@${ext.version}`,
          pointer: "/extends",
        },
        params: { detail: key },
      });
      return null;
    }
    if (!match) {
      collector.add({
        code: "OT-INH-003",
        rule: "R-INH-003",
        location: {
          document: `base:${ext.id}@${ext.version}`,
          pointer: "/extends/version",
        },
        params: { detail: key },
      });
      return null;
    }

    const baseResult = validateThemeObject(match.document);
    if (!baseResult.valid) {
      for (const d of baseResult.diagnostics) {
        collector.add({
          code: "OT-INH-002",
          rule: "R-INH-002",
          location: {
            document: `base:${themeId(match.document)}@${themeVersion(match.document)}`,
            pointer: d.location.pointer,
          },
          params: { detail: d.code },
        });
      }
      if (baseResult.diagnostics.length === 0) {
        collector.add({
          code: "OT-INH-002",
          rule: "R-INH-002",
          location: {
            document: `base:${themeId(match.document)}@${themeVersion(match.document)}`,
            pointer: "/",
          },
          params: { detail: "invalid base" },
        });
      }
      return null;
    }

    if (match.trust === "untrusted") trust = "untrusted";
    chain.unshift(match.document);
    current = match.document;
  }

  return { chain, trust };
}

/** Deep-merge base-first: child overrides; arrays of overlays merge by when key. */
export function mergeThemeDocuments(
  bases: Record<string, unknown>[],
  child: Record<string, unknown>,
): Record<string, unknown> {
  let acc: Record<string, unknown> = {};
  for (const b of [...bases, child]) {
    acc = mergeOne(acc, b);
  }
  // Child identity wins
  acc.id = child.id;
  acc.version = child.version;
  acc.name = child.name;
  if (child.extends !== undefined) acc.extends = child.extends;
  return acc;
}

function mergeOne(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (key === "extends") continue;
    if (key === "contexts" && Array.isArray(value) && Array.isArray(out.contexts)) {
      out.contexts = mergeOverlays(
        out.contexts as Record<string, unknown>[],
        value as Record<string, unknown>[],
      );
      continue;
    }
    if (
      key === "tokens" ||
      key === "components" ||
      key === "customization" ||
      key === "seeds"
    ) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        out[key] &&
        typeof out[key] === "object" &&
        !Array.isArray(out[key])
      ) {
        out[key] = deepMergeObjects(
          out[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

function deepMergeObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k]) &&
      !isTokenLeaf(v as Record<string, unknown>) &&
      !isTokenLeaf(out[k] as Record<string, unknown>)
    ) {
      out[k] = deepMergeObjects(
        out[k] as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isTokenLeaf(node: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(node, "$value") ||
    Object.prototype.hasOwnProperty.call(node, "$derive")
  );
}

function mergeOverlays(
  base: Record<string, unknown>[],
  child: Record<string, unknown>[],
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  const keyOf = (o: Record<string, unknown>) =>
    JSON.stringify(o.when ?? {}, Object.keys((o.when as object) ?? {}).sort());
  for (const o of base) map.set(keyOf(o), { ...o });
  for (const o of child) {
    const k = keyOf(o);
    const prev = map.get(k);
    if (prev) {
      map.set(k, {
        ...prev,
        ...o,
        tokens: deepMergeObjects(
          (prev.tokens as Record<string, unknown>) ?? {},
          (o.tokens as Record<string, unknown>) ?? {},
        ),
      });
    } else {
      map.set(k, { ...o });
    }
  }
  return [...map.values()];
}
