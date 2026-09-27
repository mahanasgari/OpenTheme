import { parseAlias } from "./paths.js";
import { inheritType, typesCompatible } from "./types.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";

export interface TokenNode {
  path: string;
  /** JSON pointer into the theme document. */
  pointer: string;
  type?: string;
  /** Alias target path, if `$value` is `{path}`. */
  aliasTo?: string;
  /** Paths referenced by `$derive` operands (aliases only). */
  deriveRefs: string[];
  isToken: boolean;
  /** True when the node is an injected seed/host external (not in the tree). */
  external?: boolean;
}

export interface ExternalRef {
  type?: string;
}

export interface GraphResult {
  order: string[];
  nodes: Map<string, TokenNode>;
}

const MAX_DEPTH = 16;

function collectRefsFromValue(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    const a = parseAlias(value);
    if (a) into.push(a);
    return;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.$derive && typeof obj.$derive === "object") {
      const derive = obj.$derive as { args?: Record<string, unknown> };
      for (const arg of Object.values(derive.args ?? {})) {
        collectRefsFromValue(arg, into);
      }
      return;
    }
    for (const v of Object.values(obj)) collectRefsFromValue(v, into);
  }
  if (Array.isArray(value)) {
    for (const v of value) collectRefsFromValue(v, into);
  }
}

function isTokenObject(node: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(node, "$value") ||
    Object.prototype.hasOwnProperty.call(node, "$derive")
  );
}

/** Flatten a tokens tree into path → node map (groups + tokens). */
export function flattenTokens(
  tree: Record<string, unknown>,
  prefix = "",
  pointerPrefix = "/tokens",
): Map<string, TokenNode> {
  const out = new Map<string, TokenNode>();

  function walk(
    obj: Record<string, unknown>,
    pathParts: string[],
    pointer: string,
  ): void {
    for (const [key, raw] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const node = raw as Record<string, unknown>;
      const parts = [...pathParts, key];
      const path = parts.join(".");
      const ptr = `${pointer}/${key}`;
      const token = isTokenObject(node);
      const deriveRefs: string[] = [];
      let aliasTo: string | undefined;
      if (token) {
        if (typeof node.$value === "string") {
          const a = parseAlias(node.$value);
          if (a) aliasTo = a;
        }
        if (node.$derive) collectRefsFromValue(node.$derive, deriveRefs);
      }
      const entry: TokenNode = {
        path,
        pointer: ptr,
        deriveRefs,
        isToken: token,
      };
      if (typeof node.$type === "string") entry.type = node.$type;
      if (aliasTo !== undefined) entry.aliasTo = aliasTo;
      out.set(path, entry);
      walk(node, parts, ptr);
    }
  }

  walk(tree, prefix ? prefix.split(".") : [], pointerPrefix);

  // Apply type inheritance for tokens
  const typeNodes = new Map<string, Record<string, unknown>>();
  for (const [path, n] of out) {
    const rec: Record<string, unknown> = {};
    if (n.type) rec.$type = n.type;
    typeNodes.set(path, rec);
  }
  // Re-read $type from original by storing during walk — already on entry.
  // Inheritance: fill missing types from ancestors that have $type.
  for (const [path, n] of out) {
    if (!n.isToken) continue;
    if (!n.type) {
      const inherited = inheritType(path, typeNodes);
      if (inherited) n.type = inherited;
    }
  }

  return out;
}

function edgesOf(node: TokenNode): string[] {
  const refs = [...node.deriveRefs];
  if (node.aliasTo) refs.push(node.aliasTo);
  return refs;
}

/**
 * Build the declaration graph, emit OT-REF-* diagnostics, and return a
 * topological order (Kahn) with ties broken by canonical path order.
 *
 * `externals` supplies reference targets that are not declared under `tokens`
 * but are permitted by the specification (seed.* and host-qualified paths).
 */
export function analyzeTokenGraph(
  tokens: Record<string, unknown>,
  collector: DiagnosticCollector,
  document: string = "theme",
  externals?: Map<string, ExternalRef>,
): GraphResult {
  const nodes = flattenTokens(tokens);

  // Inject permitted external leaves (seeds, host-qualified tokens)
  if (externals) {
    for (const [path, ext] of externals) {
      if (nodes.has(path)) continue;
      const entry: TokenNode = {
        path,
        pointer: `/externals/${path}`,
        deriveRefs: [],
        isToken: true,
        external: true,
      };
      if (ext.type) entry.type = ext.type;
      nodes.set(path, entry);
    }
  }

  const tokenNodes = [...nodes.values()].filter((n) => n.isToken);

  // Missing / incompatible targets
  for (const n of tokenNodes) {
    if (n.external) continue;
    for (const ref of edgesOf(n)) {
      const target = nodes.get(ref);
      if (!target || !target.isToken) {
        collector.add({
          code: "OT-REF-001",
          rule: "R-REF-001",
          location: { document, pointer: `${n.pointer}/$value` },
          params: { path: ref },
        });
        continue;
      }
      // Type compatibility applies to the token's own alias; derivation operands are typed by
      // their operation's arguments (chapter 04).
      if (ref === n.aliasTo && !typesCompatible(n.type, target.type)) {
        collector.add({
          code: "OT-REF-002",
          rule: "R-REF-002",
          location: { document, pointer: `${n.pointer}/$value` },
          params: { path: ref },
        });
      }
    }
  }

  // Adjacency: edge from dependency → dependent (Kahn: process deps first)
  const dependents = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const n of tokenNodes) {
    indegree.set(n.path, 0);
    dependents.set(n.path, new Set());
  }
  for (const n of tokenNodes) {
    for (const ref of edgesOf(n)) {
      if (!indegree.has(ref)) continue; // missing already diagnosed
      dependents.get(ref)!.add(n.path);
      indegree.set(n.path, (indegree.get(n.path) ?? 0) + 1);
    }
  }

  // Kahn with lexicographic tie-break
  const ready = [...indegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([p]) => p)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const order: string[] = [];
  while (ready.length > 0) {
    const p = ready.shift()!;
    order.push(p);
    const next = [...(dependents.get(p) ?? [])].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    for (const q of next) {
      const d = (indegree.get(q) ?? 1) - 1;
      indegree.set(q, d);
      if (d === 0) {
        // insert sorted
        let i = 0;
        while (i < ready.length && ready[i]! < q) i += 1;
        ready.splice(i, 0, q);
      }
    }
  }

  if (order.length < tokenNodes.length) {
    const inCycle = tokenNodes
      .map((n) => n.path)
      .filter((p) => !order.includes(p))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    // Emit one diagnostic per cycle member, related = all members
    const related = inCycle.map((p) => ({
      document,
      pointer: nodes.get(p)!.pointer,
    }));
    for (const p of inCycle) {
      collector.add({
        code: "OT-REF-003",
        rule: "R-REF-003",
        location: { document, pointer: nodes.get(p)!.pointer },
        related,
        params: { path: p },
      });
    }
  }

  // Depth: longest path in the DAG (only among ordered nodes)
  const depth = new Map<string, number>();
  for (const p of order) depth.set(p, 1);
  for (const p of order) {
    const n = nodes.get(p)!;
    const d0 = depth.get(p) ?? 1;
    for (const ref of edgesOf(n)) {
      if (!depth.has(ref)) continue;
      // edge ref → p means p's depth is ref's depth + 1
    }
  }
  // Recompute: for each node, depth = 1 + max(depth of deps)
  for (const p of order) {
    const n = nodes.get(p)!;
    let d = 1;
    for (const ref of edgesOf(n)) {
      const rd = depth.get(ref);
      if (rd !== undefined && rd + 1 > d) d = rd + 1;
    }
    depth.set(p, d);
    if (d > MAX_DEPTH) {
      collector.add({
        code: "OT-REF-004",
        rule: "R-REF-004",
        location: { document, pointer: n.pointer },
        params: { depth: d },
      });
      break; // one diagnostic for the chain limit
    }
  }

  return { order, nodes };
}
