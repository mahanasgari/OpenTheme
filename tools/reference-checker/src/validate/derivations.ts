import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { flattenTokens } from "../tokens/graph.js";
import { parseAlias } from "../tokens/paths.js";
import {
  getTransform,
  type TransformArg,
  type TransformDef,
} from "../transforms/registry.js";
import { EffortCounter } from "../transforms/effort.js";
import { inDomain } from "../transforms/number.js";

const MAX_NEST = 8;

type DeriveNode = { op?: unknown; args?: Record<string, unknown> };

function isDeriveObject(v: unknown): v is { $derive: DeriveNode } {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "$derive" in (v as object)
  );
}

function nestingDepth(value: unknown, depth = 0): number {
  if (!isDeriveObject(value)) return depth;
  let max = depth + 1;
  const args = value.$derive.args ?? {};
  for (const arg of Object.values(args)) {
    const d = nestingDepth(arg, depth + 1);
    if (d > max) max = d;
  }
  return max;
}

function argTypeOk(argDef: TransformArg, value: unknown): boolean {
  if (parseAlias(value)) return true;
  if (isDeriveObject(value)) return true;
  const t = argDef.type;
  if (t === "number") return typeof value === "number";
  if (t === "color") {
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "colorSpace" in (value as object)
    );
  }
  if (t === "dimension") {
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "unit" in (value as object)
    );
  }
  if (t.endsWith("[]")) return Array.isArray(value);
  return true;
}

function checkDeriveStructural(
  derive: DeriveNode,
  pointer: string,
  tokenType: string | undefined,
  collector: DiagnosticCollector,
): number {
  /** Returns effort cost for this derive tree. */
  let cost = 0;
  const op = derive.op;
  if (typeof op !== "string") {
    collector.add({
      code: "OT-DRV-001",
      rule: "R-DRV-001",
      location: { document: "theme", pointer: `${pointer}/$derive/op` },
      params: { detail: String(op) },
    });
    return 0;
  }

  const def: TransformDef | undefined = getTransform(op);
  if (!def) {
    collector.add({
      code: "OT-DRV-001",
      rule: "R-DRV-001",
      location: { document: "theme", pointer: `${pointer}/$derive/op` },
      params: { detail: op },
    });
    return 0;
  }

  cost += def.effortCost;
  const args = derive.args ?? {};
  const known = new Set(def.arguments.map((a) => a.name));

  for (const name of Object.keys(args)) {
    if (!known.has(name)) {
      collector.add({
        code: "OT-DRV-002",
        rule: "R-DRV-002",
        location: {
          document: "theme",
          pointer: `${pointer}/$derive/args/${name}`,
        },
        params: { detail: name },
      });
    }
  }

  for (const argDef of def.arguments) {
    if (!argDef.optional && !(argDef.name in args)) {
      collector.add({
        code: "OT-DRV-002",
        rule: "R-DRV-002",
        location: { document: "theme", pointer: `${pointer}/$derive/args` },
        params: { detail: argDef.name },
      });
      continue;
    }
    const value = args[argDef.name];
    if (value === undefined) continue;

    if (!argTypeOk(argDef, value)) {
      collector.add({
        code: "OT-DRV-003",
        rule: "R-DRV-003",
        location: {
          document: "theme",
          pointer: `${pointer}/$derive/args/${argDef.name}`,
        },
        params: { detail: argDef.name },
      });
    } else if (
      typeof value === "number" &&
      argDef.domain &&
      !inDomain(value, argDef.domain)
    ) {
      collector.add({
        code: "OT-DRV-004",
        rule: "R-DRV-004",
        location: {
          document: "theme",
          pointer: `${pointer}/$derive/args/${argDef.name}`,
        },
        params: { detail: String(value) },
      });
    }

    if (isDeriveObject(value)) {
      cost += checkDeriveStructural(
        value.$derive,
        `${pointer}/$derive/args/${argDef.name}`,
        undefined,
        collector,
      );
    }
  }

  if (tokenType && def.outputType !== tokenType) {
    const compatible =
      def.outputType === tokenType ||
      (def.outputType === "number" && tokenType === "opacity");
    if (!compatible) {
      collector.add({
        code: "OT-DRV-006",
        rule: "R-DRV-006",
        location: { document: "theme", pointer: `${pointer}/$derive` },
        params: { detail: def.outputType },
      });
    }
  }
  return cost;
}

function getRawAtPath(
  tree: Record<string, unknown>,
  path: string,
): Record<string, unknown> | undefined {
  let cur: unknown = tree;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
  return cur as Record<string, unknown>;
}

/**
 * Validate derivations. Structural checks once; effort counted per declared
 * mode (supported schemes × standard/high) with OT-DRV-007 over 200,000.
 * Composition depth covers nested `$derive` objects and derive→alias chains.
 */
export function validateDerivations(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  const tokens = doc.tokens;
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return;

  const schemes =
    (doc.colorSchemes as { supported?: string[] } | undefined)?.supported ??
    ["light"];
  const modeCount = schemes.length * 2; // standard + high

  const tree = tokens as Record<string, unknown>;
  const nodes = flattenTokens(tree);

  // Derive composition depth along alias edges (token A derives from B).
  const deriveTo = new Map<string, string[]>();
  for (const [path, node] of nodes) {
    if (!node.isToken || node.deriveRefs.length === 0) continue;
    deriveTo.set(path, node.deriveRefs);
  }
  const chainDepth = new Map<string, number>();
  const visiting = new Set<string>();
  function walkChain(path: string): number {
    if (chainDepth.has(path)) return chainDepth.get(path)!;
    if (visiting.has(path)) return 0;
    visiting.add(path);
    let best = 1;
    for (const ref of deriveTo.get(path) ?? []) {
      const d = 1 + walkChain(ref);
      if (d > best) best = d;
    }
    visiting.delete(path);
    chainDepth.set(path, best);
    return best;
  }
  let deepest: { path: string; depth: number; pointer: string } | undefined;
  for (const path of deriveTo.keys()) {
    const d = walkChain(path);
    if (d > MAX_NEST) {
      const node = nodes.get(path)!;
      if (!deepest || d > deepest.depth) {
        deepest = { path, depth: d, pointer: node.pointer };
      }
    }
  }
  if (deepest) {
    collector.add({
      code: "OT-DRV-005",
      rule: "R-DRV-005",
      location: { document: "theme", pointer: `${deepest.pointer}/$derive` },
      params: { detail: String(deepest.depth) },
    });
  }

  let totalCostPerMode = 0;

  for (const [, node] of nodes) {
    if (!node.isToken) continue;
    const raw = getRawAtPath(tree, node.path);
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, "$derive")) continue;
    const derive = raw.$derive as DeriveNode;
    const depth = nestingDepth({ $derive: derive });
    if (depth > MAX_NEST) {
      collector.add({
        code: "OT-DRV-005",
        rule: "R-DRV-005",
        location: { document: "theme", pointer: `${node.pointer}/$derive` },
        params: { detail: String(depth) },
      });
      continue;
    }
    totalCostPerMode += checkDeriveStructural(
      derive,
      node.pointer,
      node.type,
      collector,
    );
  }

  // Effort is identical across modes for validation (theme-only operands).
  for (let i = 0; i < modeCount; i += 1) {
    const effort = new EffortCounter();
    effort.add(totalCostPerMode);
    if (effort.isExceeded) {
      const scheme = schemes[Math.floor(i / 2)] ?? "light";
      const contrast = i % 2 === 0 ? "standard" : "high";
      collector.add({
        code: "OT-DRV-007",
        rule: "R-DRV-007",
        location: { document: "theme", pointer: "/tokens" },
        params: {
          detail: `${effort.total} in ${scheme}/${contrast}`,
        },
      });
      break; // one diagnostic is enough; all modes share the same cost
    }
  }
}
