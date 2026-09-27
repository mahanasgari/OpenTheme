/**
 * Token tree validation (chapter 03; data model §4) and the reference graph (OT-REF-*).
 */
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { aliasTarget, escapeSegment, isRecord } from "../engine/model.js";
import { BASELINE, TOKEN_TYPES, limit } from "../engine/registry.js";
import { refsOf, topologicalOrder } from "../engine/evaluate.js";
import { compatible } from "../engine/values.js";
import { inRange, shapeOf } from "./grammar.js";

const LEAF_DOLLAR = new Set(["$type", "$value", "$derive", "$description", "$deprecated", "$extensions"]);
const GROUP_DOLLAR = new Set(["$type", "$description", "$deprecated", "$extensions"]);
const SEGMENT = /^[a-z][a-z0-9-]*$/;

export interface GraphNode {
  readonly path: string;
  readonly type: string | undefined;
  readonly pointer: string;
  readonly raw: unknown;
  readonly external: boolean;
}

function isLeaf(n: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(n, "$value") || Object.prototype.hasOwnProperty.call(n, "$derive");
}

function rejectUnknownDollar(node: Record<string, unknown>, pointer: string, c: DiagnosticCollector): void {
  const allowed = isLeaf(node) ? LEAF_DOLLAR : GROUP_DOLLAR;
  for (const key of Object.keys(node)) {
    if (key.startsWith("$") && !allowed.has(key)) {
      c.add("OT-DOC-003", { document: "theme", pointer: `${pointer}/${escapeSegment(key)}` });
    }
  }
}

/** Every alias target inside a value, including derivation operands. */
export function refsIn(v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    const t = aliasTarget(x);
    if (t) out.push(t);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (isRecord(x)) Object.values(x).forEach(walk);
  };
  walk(v);
  return out;
}

export interface TokenValidation {
  readonly nodes: Map<string, GraphNode>;
}

export function validateTokenTree(
  doc: Record<string, unknown>,
  c: DiagnosticCollector,
  hostTokenTypes: ReadonlyMap<string, string>,
): TokenValidation {
  const nodes = new Map<string, GraphNode>();
  const tokens = doc.tokens;
  if (tokens === undefined) return { nodes };
  if (!isRecord(tokens)) {
    c.add("OT-TOK-004", { document: "theme", pointer: "/tokens" });
    return { nodes };
  }
  rejectUnknownDollar(tokens, "/tokens", c);
  const maxPath = limit("pathLength");
  const maxSeg = limit("pathSegmentLength");

  // `prefix` is the dotted path of `obj` ("" at the root).
  const walk = (obj: Record<string, unknown>, prefix: string, pointer: string, inherited: string | undefined) => {
    for (const key of Object.keys(obj)) {
      if (key.charCodeAt(0) === 0x24 /* $ */) continue;
      const raw = obj[key];
      const ptr = `${pointer}/${escapeSegment(key)}`;
      if (!SEGMENT.test(key) || key.length > maxSeg) {
        c.add(key.length > maxSeg ? "OT-LIM-006" : "OT-TOK-001", { document: "theme", pointer: ptr });
        continue;
      }
      if (!isRecord(raw)) continue;
      const path = prefix === "" ? key : `${prefix}.${key}`;
      rejectUnknownDollar(raw, ptr, c);
      if (raw.$deprecated) c.add("OT-VER-005", { document: "theme", pointer: ptr }, { params: { detail: path } });
      if (prefix === "" && key === "seed") c.add("OT-TOK-003", { document: "theme", pointer: ptr });
      if (path.length > maxPath) c.add("OT-LIM-006", { document: "theme", pointer: ptr });
      const type = typeof raw.$type === "string" ? raw.$type : inherited;
      if (typeof raw.$type === "string" && !TOKEN_TYPES.has(raw.$type)) {
        c.add("OT-TOK-006", { document: "theme", pointer: `${ptr}/$type` });
      }
      if (isLeaf(raw)) {
        const hasValue = Object.prototype.hasOwnProperty.call(raw, "$value");
        const hasDerive = Object.prototype.hasOwnProperty.call(raw, "$derive");
        if (hasValue === hasDerive) c.add("OT-TOK-007", { document: "theme", pointer: ptr });
        const effectiveType = type ?? BASELINE.get(path)?.type;
        if (hasValue && aliasTarget(raw.$value) === null && effectiveType && TOKEN_TYPES.has(effectiveType)) {
          if (!shapeOf(effectiveType, raw.$value)) {
            c.add("OT-TOK-004", { document: "theme", pointer: `${ptr}/$value` });
          } else if (!inRange(effectiveType, raw.$value, BASELINE.get(path)?.range)) {
            c.add("OT-TOK-005", { document: "theme", pointer: `${ptr}/$value` });
          }
        }
        nodes.set(path, {
          path,
          type: effectiveType,
          pointer: ptr,
          raw: hasDerive ? Object.freeze({ $derive: raw.$derive }) : raw.$value,
          external: false,
        });
      }
      walk(raw, path, ptr, type);
    }
  };
  walk(tokens, "", "/tokens", undefined);

  // External targets: baseline tokens (always defined), the theme's seeds, and host tokens.
  const ext = (path: string, type: string) => {
    if (!nodes.has(path)) nodes.set(path, { path, type, pointer: `/externals/${path}`, raw: undefined, external: true });
  };
  for (const t of BASELINE.values()) if (!t.path.startsWith("seed.")) ext(t.path, t.type);
  const seeds = isRecord(doc.seeds) ? doc.seeds : {};
  for (const [scheme, block] of Object.entries(seeds)) {
    if (scheme === "fontFamily") {
      ext("seed.font-family", "fontFamily");
      continue;
    }
    if (!isRecord(block)) continue;
    for (const role of ["background", "foreground", "accent"]) if (block[role] !== undefined) ext(`seed.${role}`, "color");
  }
  for (const [p, t] of hostTokenTypes) ext(p, t);
  analyzeGraph(nodes, c);
  return { nodes };
}

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function analyzeGraph(nodes: Map<string, GraphNode>, c: DiagnosticCollector): void {
  const own = [...nodes.values()].filter((n) => !n.external);
  const edges = new Map<string, string[]>();
  for (const n of nodes.values()) edges.set(n.path, n.external ? [] : (refsOf(n.raw) as string[]));
  for (const n of own) {
    const aliasOf = aliasTarget(n.raw);
    for (const ref of edges.get(n.path)!) {
      const target = nodes.get(ref);
      if (!target) {
        c.add("OT-REF-001", { document: "theme", pointer: `${n.pointer}/$value` }, { params: { detail: ref } });
        continue;
      }
      if (aliasOf === ref && n.type && target.type && !compatible(n.type, target.type)) {
        c.add("OT-REF-002", { document: "theme", pointer: `${n.pointer}/$value` }, { params: { detail: ref } });
      }
    }
  }
  // Kahn order over every node (dependencies first), ties by code-unit path order.
  const paths = [...nodes.keys()].sort(codeUnitCompare);
  const rank = new Map<string, number>();
  for (let i = 0; i < paths.length; i += 1) rank.set(paths[i]!, i);
  const { order } = topologicalOrder(paths, rank, (i) => edges.get(paths[i]!)!);
  // Cycle members only (tokens that can reach themselves), per FR-059 "the tokens in the cycle".
  const done = new Set(order);
  const remaining = [...nodes.keys()].filter((p) => !done.has(p));
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [...(edges.get(from) ?? [])];
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (x === to) return true;
      if (seen.has(x) || !nodes.has(x)) continue;
      seen.add(x);
      stack.push(...(edges.get(x) ?? []));
    }
    return false;
  };
  const members = remaining.filter((p) => reaches(p, p)).sort(codeUnitCompare);
  const related = members.map((p) => ({ document: "theme", pointer: nodes.get(p)!.pointer }));
  for (const p of members) c.add("OT-REF-003", { document: "theme", pointer: nodes.get(p)!.pointer }, { related });
  // Chain depth: one diagnostic at the first token (in evaluation order) whose depth exceeds the limit.
  const maxDepth = limit("referenceDepth");
  const depth = new Map<string, number>();
  for (const p of order) {
    let d = 1;
    for (const ref of edges.get(p)!) {
      const rd = depth.get(ref);
      if (rd !== undefined && rd + 1 > d) d = rd + 1;
    }
    depth.set(p, d);
    if (d > maxDepth) {
      c.add("OT-REF-004", { document: "theme", pointer: nodes.get(p)!.pointer }, { params: { detail: d } });
      break;
    }
  }
}
