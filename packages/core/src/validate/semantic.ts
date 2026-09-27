/**
 * Semantic validators (chapter 13 steps 6–14): seeds, derivations, contexts, components,
 * customization, limits, and layout.
 */
import { contrastRatio, quantize, type Srgb8 } from "../color/index.js";
import { jcs } from "../canonical/jcs.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { aliasTarget, escapeSegment, flattenTokenTree, isRecord } from "../engine/model.js";
import {
  BASELINE,
  type Contract,
  DIMENSIONS,
  STANDARD_POINTS,
  TRANSFORMS,
  type TransformArgDef,
  limit,
} from "../engine/registry.js";
import { colorLiteral } from "../engine/values.js";
import { fromLiteral } from "../color/index.js";
import { quantizeChannel, quantizeAlpha } from "../color/index.js";

const T = "theme";

// --- Seeds (chapter 07; A11Y-001 uses direct quantization of sRGB literals) ---

function quantizeSeed(v: unknown): Srgb8 | null {
  const lit = colorLiteral(v);
  if (!lit) return null;
  if (lit.colorSpace === "srgb") {
    const [r, g, b] = lit.components;
    return { srgb8: [quantizeChannel(r), quantizeChannel(g), quantizeChannel(b)], alpha: quantizeAlpha(lit.alpha ?? 1) };
  }
  return quantize(fromLiteral(lit));
}

export function validateSeeds(doc: Record<string, unknown>, c: DiagnosticCollector): void {
  const cs = isRecord(doc.colorSchemes) ? doc.colorSchemes : undefined;
  const seeds = isRecord(doc.seeds) ? doc.seeds : undefined;
  if (!cs || !Array.isArray(cs.supported) || !seeds) return;
  const variants = isRecord(cs.variants) ? cs.variants : {};
  for (const scheme of cs.supported as string[]) {
    const v = variants[scheme];
    const fallback = isRecord(v) && typeof v.fallback === "string" ? v.fallback : undefined;
    const key = seeds[scheme] !== undefined ? scheme : fallback ?? scheme;
    const block = seeds[key];
    if (!isRecord(block)) {
      c.add("OT-TOK-010", { document: T, pointer: `/seeds/${scheme}` });
      continue;
    }
    for (const role of ["background", "foreground", "accent"]) {
      const lit = colorLiteral(block[role]);
      if (!lit || !("colorSpace" in (block[role] as object))) {
        c.add("OT-TOK-010", { document: T, pointer: `/seeds/${scheme}/${role}` });
        continue;
      }
      if ((lit.alpha ?? 1) < 1) c.add("OT-TOK-011", { document: T, pointer: `/seeds/${scheme}/${role}` });
    }
    const bg = quantizeSeed(block.background);
    const fg = quantizeSeed(block.foreground);
    if (bg && fg && contrastRatio(fg, bg) < 4.5) {
      c.add(
        "OT-A11Y-001",
        { document: T, pointer: `/seeds/${scheme}/foreground` },
        {
          related: [
            { document: T, pointer: `/seeds/${scheme}/background` },
            { document: T, pointer: `/seeds/${scheme}/foreground` },
          ],
        },
      );
    }
  }
}

// --- Derivations (chapter 04; structural checks, composition depth) ---

function isDerive(v: unknown): v is { $derive: Record<string, unknown> } {
  return isRecord(v) && "$derive" in v;
}

function nesting(v: unknown): number {
  if (!isDerive(v)) return 0;
  const args = isRecord(v.$derive) && isRecord(v.$derive.args) ? v.$derive.args : {};
  let max = 0;
  for (const a of Object.values(args)) {
    const items = Array.isArray(a) ? a : [a];
    for (const x of items) max = Math.max(max, nesting(x));
  }
  return 1 + max;
}

function operandShapeOk(def: TransformArgDef, v: unknown): boolean {
  if (aliasTarget(v) !== null || isDerive(v)) return true;
  const t = def.type;
  if (t.endsWith("[]")) return Array.isArray(v) && v.every((x) => operandShapeOk({ ...def, type: t.slice(0, -2) }, x));
  if (t === "number") return typeof v === "number" && Number.isFinite(v);
  if (t === "color") return colorLiteral(v) !== null;
  if (t === "dimension") return isRecord(v) && typeof v.value === "number" && v.unit === "px";
  return true;
}

function literalInDomain(def: TransformArgDef, v: unknown): boolean {
  const d = def.domain;
  if (!d) return true;
  if (Array.isArray(v)) {
    if (d.minItems !== undefined && v.length < d.minItems) return false;
    if (d.maxItems !== undefined && v.length > d.maxItems) return false;
    return true;
  }
  const n = typeof v === "number" ? v : isRecord(v) && typeof v.value === "number" && def.type === "dimension" ? v.value : undefined;
  if (n === undefined) {
    if (d.opaque && colorLiteral(v) && (colorLiteral(v)!.alpha ?? 1) < 1) return false;
    return true;
  }
  if (d.min !== undefined && n < d.min) return false;
  if (d.max !== undefined && n > d.max) return false;
  if (d.exclusiveMinimum !== undefined && n <= d.exclusiveMinimum) return false;
  return true;
}

function checkDerive(derive: unknown, pointer: string, tokenType: string | undefined, c: DiagnosticCollector): void {
  const d = isRecord(derive) ? derive : {};
  const def = typeof d.op === "string" ? TRANSFORMS.get(d.op) : undefined;
  if (!def) {
    c.add("OT-DRV-001", { document: T, pointer: `${pointer}/$derive/op` });
    return;
  }
  const args = isRecord(d.args) ? d.args : {};
  const known = new Set(def.arguments.map((a) => a.name));
  for (const name of Object.keys(args)) {
    if (!known.has(name)) c.add("OT-DRV-002", { document: T, pointer: `${pointer}/$derive/args/${escapeSegment(name)}` });
  }
  for (const a of def.arguments) {
    if (!(a.name in args)) {
      if (!a.optional) c.add("OT-DRV-002", { document: T, pointer: `${pointer}/$derive/args` });
      continue;
    }
    const v = args[a.name];
    const argPtr = `${pointer}/$derive/args/${a.name}`;
    if (!operandShapeOk(a, v)) c.add("OT-DRV-003", { document: T, pointer: argPtr });
    else if (aliasTarget(v) === null && !isDerive(v) && !literalInDomain(a, v)) c.add("OT-DRV-004", { document: T, pointer: argPtr });
    const items = Array.isArray(v) ? v : [v];
    items.forEach((x, i) => {
      if (isDerive(x)) checkDerive(x.$derive, Array.isArray(v) ? `${argPtr}/${i}` : argPtr, a.type.replace("[]", ""), c);
    });
  }
  if (tokenType && def.outputType !== tokenType && !(def.outputType === "number" && tokenType === "opacity")) {
    c.add("OT-DRV-006", { document: T, pointer: `${pointer}/$derive` });
  }
}

export function validateDerivations(
  doc: Record<string, unknown>,
  nodes: ReadonlyMap<string, { pointer: string; raw: unknown; type: string | undefined; external: boolean }>,
  c: DiagnosticCollector,
): void {
  const maxNest = limit("derivationDepth");
  // Composition depth through derivation operands that alias other derived tokens.
  const derived = new Map<string, string[]>();
  for (const [p, n] of nodes) {
    if (!n.external && isDerive(n.raw)) {
      const refs: string[] = [];
      const walk = (x: unknown) => {
        const t = aliasTarget(x);
        if (t && nodes.get(t) && isDerive(nodes.get(t)!.raw)) refs.push(t);
        else if (Array.isArray(x)) x.forEach(walk);
        else if (isRecord(x)) Object.values(x).forEach(walk);
      };
      walk(n.raw);
      derived.set(p, refs);
    }
  }
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const chain = (p: string): number => {
    if (memo.has(p)) return memo.get(p)!;
    if (visiting.has(p)) return 0;
    visiting.add(p);
    let best = 1;
    for (const r of derived.get(p) ?? []) best = Math.max(best, 1 + chain(r));
    visiting.delete(p);
    memo.set(p, best);
    return best;
  };
  let deepest: { depth: number; pointer: string } | undefined;
  for (const p of derived.keys()) {
    const d = chain(p);
    if (d > maxNest && (!deepest || d > deepest.depth)) deepest = { depth: d, pointer: nodes.get(p)!.pointer };
  }
  if (deepest) c.add("OT-DRV-005", { document: T, pointer: `${deepest.pointer}/$derive` });
  for (const [, n] of nodes) {
    if (n.external || !isDerive(n.raw)) continue;
    if (nesting(n.raw) > maxNest) {
      c.add("OT-DRV-005", { document: T, pointer: `${n.pointer}/$derive` });
      continue;
    }
    checkDerive(n.raw.$derive, n.pointer, n.type, c);
  }
}

// --- Contexts (chapter 06) ---

export function validateContexts(doc: Record<string, unknown>, declared: ReadonlySet<string>, c: DiagnosticCollector): void {
  if (!Array.isArray(doc.contexts)) return;
  const cs = isRecord(doc.colorSchemes) ? doc.colorSchemes : {};
  const supported = new Set(Array.isArray(cs.supported) ? (cs.supported as string[]) : []);
  const seen = new Map<string, number>();
  doc.contexts.forEach((o, index) => {
    if (!isRecord(o)) return;
    const ptr = `/contexts/${index}`;
    if (!isRecord(o.when)) {
      c.add("OT-CTX-001", { document: T, pointer: `${ptr}/when` });
      return;
    }
    for (const [dim, val] of Object.entries(o.when)) {
      const def = DIMENSIONS[dim];
      const wptr = `${ptr}/when/${escapeSegment(dim)}`;
      if (!def) {
        c.add("OT-CTX-001", { document: T, pointer: wptr });
        continue;
      }
      if (typeof val !== "string" || !def.values.includes(val)) {
        c.add("OT-CTX-001", { document: T, pointer: wptr });
      } else if (dim === "colorScheme" && !supported.has(val)) {
        c.add("OT-CTX-003", { document: T, pointer: wptr });
      }
    }
    const key = jcs(o.when);
    if (seen.has(key)) {
      c.add("OT-CTX-002", { document: T, pointer: `${ptr}/when` }, { related: [{ document: T, pointer: `/contexts/${seen.get(key)}/when` }] });
    } else {
      seen.set(key, index);
    }
    flattenTokenTree(o.tokens, `${ptr}/tokens`, (path, _node, _type, pointer) => {
      if (!path.split(".").every((s) => /^[a-z][a-z0-9-]*$/.test(s))) return;
      if (!declared.has(path)) c.add("OT-CTX-004", { document: T, pointer });
    });
  });
}

// --- Components (chapter 08) ---

function compatiblePin(pin: string, version: string): boolean {
  const [pm, pn] = pin.split(".").map(Number);
  const [cm, cn] = version.split(".").map(Number);
  return pm === cm && (pn ?? 0) <= (cn ?? 0);
}

export function validateComponents(
  doc: Record<string, unknown>,
  contracts: ReadonlyMap<string, Contract>,
  c: DiagnosticCollector,
  hostSupplied: boolean,
): void {
  if (!isRecord(doc.components)) return;
  for (const [id, styling] of Object.entries(doc.components)) {
    const base = `/components/${escapeSegment(id)}`;
    const contract = contracts.get(id);
    if (!contract) {
      // Only contracts known to the validator are judged: standard ones, or a supplied host's.
      if (hostSupplied || id.startsWith("std/")) c.add("OT-CMP-001", { document: T, pointer: base });
      continue;
    }
    if (!isRecord(styling)) continue;
    if (typeof styling.contract === "string" && !compatiblePin(styling.contract, contract.version)) {
      c.add("OT-CMP-002", { document: T, pointer: `${base}/contract` });
      continue;
    }
    const checkParts = (parts: unknown, ptr: string) => {
      if (!isRecord(parts)) return;
      for (const [part, props] of Object.entries(parts)) {
        const pptr = `${ptr}/${escapeSegment(part)}`;
        if (!contract.parts.includes(part)) {
          c.add("OT-CMP-003", { document: T, pointer: pptr });
          continue;
        }
        if (!isRecord(props)) continue;
        const allowed = contract.properties[part] ?? {};
        for (const [prop, value] of Object.entries(props)) {
          const vptr = `${pptr}/${escapeSegment(prop)}`;
          if (!(prop in allowed)) {
            c.add("OT-CMP-003", { document: T, pointer: vptr });
            continue;
          }
          if (isRecord(value) && isRecord(value.$states)) {
            for (const state of Object.keys(value.$states)) {
              if (!contract.states.includes(state)) {
                c.add("OT-CMP-004", { document: T, pointer: `${vptr}/$states/${escapeSegment(state)}` });
              }
            }
          }
        }
      }
    };
    checkParts(styling.parts, `${base}/parts`);
    if (isRecord(styling.variants)) {
      for (const [axis, values] of Object.entries(styling.variants)) {
        const aptr = `${base}/variants/${escapeSegment(axis)}`;
        const allowed = contract.variants?.[axis];
        if (!allowed) {
          c.add("OT-CMP-004", { document: T, pointer: aptr });
          continue;
        }
        if (!isRecord(values)) continue;
        for (const [value, body] of Object.entries(values)) {
          const vptr = `${aptr}/${escapeSegment(value)}`;
          if (!allowed.includes(value)) {
            c.add("OT-CMP-004", { document: T, pointer: vptr });
            continue;
          }
          if (isRecord(body)) checkParts(body.parts, `${vptr}/parts`);
        }
      }
    }
  }
}

// --- Customization (chapter 09) ---

function wholeSteps(min: number, max: number, step: number): boolean {
  return step > 0 && Number.isInteger((max - min) / step);
}

export function validateCustomization(
  doc: Record<string, unknown>,
  declared: ReadonlySet<string>,
  c: DiagnosticCollector,
): void {
  const custom = isRecord(doc.customization) ? doc.customization : undefined;
  if (!custom || !Array.isArray(custom.points)) return;
  custom.points.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== "string") return;
    const p = raw;
    const ptr = `/customization/points/${index}`;
    const std = STANDARD_POINTS.get(p.id as string);
    const target = p.target;
    if ((target === undefined || (Array.isArray(target) && target.length === 0)) && !std) {
      c.add("OT-CUS-003", { document: T, pointer: `${ptr}/target` });
    } else if (Array.isArray(target) && !std) {
      if (target.some((t) => typeof t !== "string" || !declared.has(t))) {
        c.add("OT-CUS-003", { document: T, pointer: `${ptr}/target` });
      }
    }
    const cons = isRecord(p.constraints) ? p.constraints : undefined;
    const range = cons && isRecord(cons.range) ? cons.range : undefined;
    const type = typeof p.type === "string" ? p.type : std?.type;
    if (range && typeof range.min === "number" && typeof range.max === "number" && typeof range.step === "number") {
      if (!wholeSteps(range.min, range.max, range.step)) c.add("OT-CUS-004", { document: T, pointer: `${ptr}/constraints` });
    }
    if (p.id === "std.text-size" && range && typeof range.min === "number" && range.min < 1) {
      c.add("OT-CUS-005", { document: T, pointer: `${ptr}/constraints/range/min` });
    }
    if (isRecord(p.effectiveRange) && typeof p.effectiveRange.max === "number" && p.effectiveRange.max < 2) {
      c.add("OT-CUS-001", { document: T, pointer: `${ptr}/effectiveRange/max` });
    }
    if (cons && type) {
      const numeric = type === "number" || type === "dimension";
      const fits =
        ("enum" in cons && type !== "color") ||
        "presets" in cons ||
        (range !== undefined && (("gamut" in range && type === "color") || (!("gamut" in range) && numeric)));
      if (!fits) c.add("OT-CUS-002", { document: T, pointer: `${ptr}/constraints` });
    }
    if (p.default !== undefined && p.default !== null && cons) {
      let ok = true;
      if (range && typeof range.min === "number" && typeof range.max === "number") {
        const n = typeof p.default === "number" ? p.default : isRecord(p.default) && typeof p.default.value === "number" ? p.default.value : undefined;
        if (n !== undefined && (n < range.min || n > range.max)) ok = false;
      }
      if (Array.isArray(cons.enum) && !cons.enum.some((e) => jcs(e) === jcs(p.default))) ok = false;
      if (!ok) c.add("OT-CUS-001", { document: T, pointer: `${ptr}/default` });
    }
    if (std) {
      if (typeof p.type === "string" && p.type !== std.type) c.add("OT-CUS-006", { document: T, pointer: `${ptr}/type` });
      if (Array.isArray(target) && Array.isArray(std.target)) {
        if ([...target].sort().join(",") !== [...(std.target as string[])].sort().join(",")) {
          c.add("OT-CUS-006", { document: T, pointer: `${ptr}/target` });
        }
      }
    }
  });
}

// --- Limits (chapter 12) ---

export function validateLimits(doc: Record<string, unknown>, tokenCount: number, c: DiagnosticCollector): void {
  if (tokenCount > limit("tokens")) c.add("OT-LIM-003", { document: T, pointer: "/tokens" });
  if (Array.isArray(doc.contexts) && doc.contexts.length > limit("overlays")) c.add("OT-LIM-005", { document: T, pointer: "/contexts" });
  if (isRecord(doc.components) && Object.keys(doc.components).length > limit("styledContracts")) {
    c.add("OT-LIM-005", { document: T, pointer: "/components" });
  }
  const custom = isRecord(doc.customization) ? doc.customization : undefined;
  if (custom && Array.isArray(custom.points) && custom.points.length > limit("customizationPoints")) {
    c.add("OT-LIM-004", { document: T, pointer: "/customization/points" });
  }
  if (isRecord(doc.localized) && Object.keys(doc.localized).length > limit("localizedVariants")) {
    c.add("OT-LIM-005", { document: T, pointer: "/localized" });
  }
}

// --- Layout (chapter 08) ---

export function validateLayout(doc: Record<string, unknown>, c: DiagnosticCollector): void {
  const layout = isRecord(doc.layout) ? doc.layout : undefined;
  if (!layout || !isRecord(layout.metrics)) return;
  const m = layout.metrics;
  const sum = (a: unknown) => (Array.isArray(a) ? a.reduce((s: number, x) => s + (typeof x === "number" ? x : 0), 0) : 0);
  if (sum(m.minWidths) + sum(m.fixedWidths) + sum(m.gutters) > 320) c.add("OT-LAY-002", { document: T, pointer: "/layout/metrics" });
}

export function isBaselinePath(p: string): boolean {
  return BASELINE.has(p);
}
