/**
 * Declaration layering and graph evaluation (chapter 10 stages 3–4; research R11, R12).
 */
import type { Lab } from "../color/index.js";
import * as C from "../transforms/color.js";
import * as N from "../transforms/number.js";
import { aliasTarget, isRecord, type Raw, seedSchemeOf, type ThemeModel } from "./model.js";
import {
  BASELINE,
  DIMENSION_PRIORITY,
  EFFORT_BUDGET,
  TRANSFORMS,
  type TokenType,
  type TransformArgDef,
} from "./registry.js";
import { compatible, decodeLiteral, type Value } from "./values.js";

export interface EvalContext {
  readonly colorScheme: string;
  readonly contrast: "standard" | "high";
  readonly motion: "standard" | "reduced";
  readonly density: "compact" | "standard" | "comfortable";
  readonly sizeClass: "compact" | "medium" | "expanded";
}

export interface Decl {
  readonly path: string;
  readonly type: TokenType;
  readonly raw: Raw;
  /** 1 defaults, 2 theme, 3 user, 4 policy. */
  readonly layer: 1 | 2 | 3 | 4;
  readonly document: string;
  readonly pointer: string;
}

export interface HostTokenDef {
  readonly path: string;
  readonly type: TokenType;
  readonly default: Raw;
}

function overlayMatches(model: ThemeModel, when: Readonly<Record<string, string>>, ctx: EvalContext): boolean {
  for (const [dim, value] of Object.entries(when)) {
    if (dim === "colorScheme") {
      if (value !== ctx.colorScheme && value !== seedSchemeOf(model, ctx.colorScheme)) return false;
    } else if ((ctx as unknown as Record<string, string>)[dim] !== value) {
      return false;
    }
  }
  return true;
}

function priorityKey(when: Readonly<Record<string, string>>): number[] {
  // Higher-priority dimensions sort later so they win among equally specific overlays.
  return DIMENSION_PRIORITY.map((d) => (d in when ? 1 : 0));
}

/** Overlays that apply to ctx, in application order (ascending specificity, then priority). */
export function applicableOverlays(model: ThemeModel, ctx: EvalContext) {
  const matching = model.overlays.filter((o) => overlayMatches(model, o.when, ctx));
  return matching
    .map((o) => ({ o, spec: Object.keys(o.when).length, key: priorityKey(o.when) }))
    .sort((a, b) => {
      if (a.spec !== b.spec) return a.spec - b.spec;
      for (let i = DIMENSION_PRIORITY.length - 1; i >= 0; i -= 1) {
        const d = a.key[i]! - b.key[i]!;
        if (d !== 0) return d;
      }
      return a.o.index - b.o.index;
    })
    .map((x) => x.o);
}

/** Build layers 1–2 for a context: baseline and host defaults, seeds, theme values, overlays. */
export function declareBase(
  model: ThemeModel,
  ctx: EvalContext,
  hostTokens: readonly HostTokenDef[] = [],
  document = "theme",
): Map<string, Decl> {
  const decls = new Map<string, Decl>();
  const high = ctx.contrast === "high";
  for (const t of BASELINE.values()) {
    if (t.reserved) continue;
    const raw = high && t.type === "color" && t.highContrastDefault != null ? t.highContrastDefault : t.default;
    decls.set(t.path, { path: t.path, type: t.type, raw, layer: 1, document: "specification", pointer: "" });
  }
  const scheme = seedSchemeOf(model, ctx.colorScheme);
  const seeds = model.seeds;
  const schemeSeeds = (isRecord(seeds[ctx.colorScheme]) ? seeds[ctx.colorScheme] : seeds[scheme]) as
    | Record<string, unknown>
    | undefined;
  for (const role of ["background", "foreground", "accent"] as const) {
    decls.set(`seed.${role}`, {
      path: `seed.${role}`,
      type: "color",
      raw: schemeSeeds?.[role],
      layer: 2,
      document,
      pointer: `/seeds/${ctx.colorScheme in seeds ? ctx.colorScheme : scheme}/${role}`,
    });
  }
  decls.set("seed.font-family", {
    path: "seed.font-family",
    type: "fontFamily",
    raw: seeds.fontFamily,
    layer: 2,
    document,
    pointer: "/seeds/fontFamily",
  });
  for (const h of hostTokens) {
    decls.set(h.path, { path: h.path, type: h.type, raw: h.default, layer: 1, document: "host", pointer: "" });
  }
  for (const t of model.tokens.values()) {
    if (high && t.type === "color") continue; // R11: theme colors are not used in high contrast
    decls.set(t.path, { path: t.path, type: t.type, raw: t.raw, layer: 2, document, pointer: t.pointer });
  }
  for (const o of applicableOverlays(model, ctx)) {
    const hcOverlay = o.when.contrast === "high";
    for (const [path, v] of o.tokens) {
      const type = (decls.get(path)?.type ?? model.tokens.get(path)?.type ?? BASELINE.get(path)?.type) as
        | TokenType
        | undefined;
      if (!type) continue;
      if (high && type === "color" && !hcOverlay) continue;
      decls.set(path, { path, type, raw: v.raw, layer: 2, document, pointer: v.pointer });
    }
  }
  return decls;
}

/** Every alias target referenced anywhere inside a raw value (aliases, derivations, composites). */
const NO_REFS: readonly string[] = Object.freeze([]);
const refsCache = new WeakMap<object, readonly string[]>();

/** Every alias target in a raw value. Frozen objects are cached: they are shared across modes. */
export function refsOf(raw: Raw): readonly string[] {
  if (typeof raw === "string") {
    const t = aliasTarget(raw);
    return t ? [t] : NO_REFS;
  }
  if (raw === null || typeof raw !== "object") return NO_REFS;
  const hit = refsCache.get(raw);
  if (hit) return hit;
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      const t = aliasTarget(v);
      if (t) out.push(t);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (isRecord(v)) for (const x of Object.values(v)) walk(x);
  };
  walk(raw);
  const refs = out.length === 0 ? NO_REFS : out;
  // Only a frozen value can never change under the cache.
  if (Object.isFrozen(raw)) refsCache.set(raw, refs);
  return refs;
}

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The last ranking; a theme's modes declare the same key set, so it is usually reused. */
let lastRanking: { readonly paths: readonly string[]; readonly rank: ReadonlyMap<string, number> } | null = null;

function ranking(decls: ReadonlyMap<string, Decl>) {
  if (lastRanking && lastRanking.paths.length === decls.size) {
    let same = true;
    for (const k of decls.keys()) {
      if (!lastRanking.rank.has(k)) {
        same = false;
        break;
      }
    }
    if (same) return lastRanking;
  }
  const paths = [...decls.keys()].sort(codeUnitCompare);
  const rank = new Map<string, number>();
  for (let i = 0; i < paths.length; i += 1) rank.set(paths[i]!, i);
  lastRanking = { paths, rank };
  return lastRanking;
}

/**
 * Topological order with ties broken by code-unit path order: among the ready paths, the smallest
 * always comes next (Kahn's algorithm over integer ranks). `paths` is sorted in code-unit order and
 * `rank` maps each path to its index. A path that references itself, or is on a cycle, never
 * becomes ready and is returned in `cyclic`, sorted.
 */
export function topologicalOrder(
  paths: readonly string[],
  rank: ReadonlyMap<string, number>,
  refsAt: (i: number) => readonly string[],
): { order: string[]; cyclic: string[] } {
  const n = paths.length;
  const indegree = new Int32Array(n);
  const dependents: (number[] | undefined)[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const refs = refsAt(i);
    let seen: Set<number> | undefined;
    for (const r of refs) {
      const j = rank.get(r);
      if (j === undefined) continue;
      if (j === i) {
        indegree[i]! += 1; // a self-reference never becomes ready
        continue;
      }
      if (refs.length > 1) {
        seen ??= new Set();
        if (seen.has(j)) continue;
        seen.add(j);
      }
      indegree[i]! += 1;
      (dependents[j] ??= []).push(i);
    }
  }
  const heap: number[] = [];
  const push = (v: number) => {
    let i = heap.push(v) - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]! <= v) break;
      heap[i] = heap[p]!;
      i = p;
    }
    heap[i] = v;
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= heap.length) break;
        const c = l + 1 < heap.length && heap[l + 1]! < heap[l]! ? l + 1 : l;
        if (heap[c]! >= last) break;
        heap[i] = heap[c]!;
        i = c;
      }
      heap[i] = last;
    }
    return top;
  };
  for (let i = 0; i < n; i += 1) if (indegree[i] === 0) push(i);
  const order: string[] = [];
  const done = new Uint8Array(n);
  while (heap.length > 0) {
    const i = pop();
    order.push(paths[i]!);
    done[i] = 1;
    for (const q of dependents[i] ?? []) {
      indegree[q]! -= 1;
      if (indegree[q] === 0) push(q);
    }
  }
  const cyclic: string[] = [];
  for (let i = 0; i < n; i += 1) if (!done[i]) cyclic.push(paths[i]!);
  return { order, cyclic };
}

/** Evaluation order of declarations (chapter 10, stage 4). */
export function kahnOrder(decls: ReadonlyMap<string, Decl>): { order: string[]; cyclic: string[] } {
  const { paths, rank } = ranking(decls);
  return topologicalOrder(paths, rank, (i) => refsOf(decls.get(paths[i]!)!.raw));
}

export interface EvalIssue {
  readonly code: string;
  readonly path: string;
  readonly document: string;
  readonly pointer: string;
  readonly params?: Record<string, unknown>;
}

export interface EvalResult {
  readonly values: Map<string, Value>;
  readonly issues: EvalIssue[];
  readonly effort: number;
  readonly userDependent: Set<string>;
}

class EffortExceeded extends Error {}

function clampDomain(v: number, d: TransformArgDef["domain"]): number {
  if (!d) return v;
  if (d.min !== undefined && v < d.min) return d.min;
  if (d.max !== undefined && v > d.max) return d.max;
  return v;
}

function inDomain(v: number, d: TransformArgDef["domain"]): boolean {
  if (!d) return true;
  if (d.min !== undefined && v < d.min) return false;
  if (d.max !== undefined && v > d.max) return false;
  if (d.exclusiveMinimum !== undefined && v <= d.exclusiveMinimum) return false;
  return true;
}

/**
 * Walks a raw value's derivations exactly as evaluation does (`evalDerive`): every known operation
 * once, operands per the operation's argument list, aliases never followed.
 */
function forEachDerive(
  raw: Raw,
  visit: (def: NonNullable<ReturnType<typeof TRANSFORMS.get>>, args: Readonly<Record<string, unknown>>) => void,
): void {
  const operand = (x: unknown): void => {
    if (aliasTarget(x) !== null) return;
    if (isRecord(x) && "$derive" in x) derive(x.$derive);
  };
  const derive = (d: unknown): void => {
    if (!isRecord(d)) return;
    const def = TRANSFORMS.get(String(d.op));
    if (!def) return;
    const args = isRecord(d.args) ? d.args : {};
    visit(def, args);
    for (const a of def.arguments) {
      if (a.type.endsWith("[]")) (Array.isArray(args[a.name]) ? (args[a.name] as unknown[]) : []).forEach(operand);
      else operand(args[a.name]);
    }
  };
  operand(raw);
}

/** Per frozen raw value: its derivations' total effort, and whether it can report OT-DRV-004. */
const deriveFacts = new WeakMap<object, { readonly effort: number; readonly domainAlias: boolean }>();

function factsOf(raw: Raw): { readonly effort: number; readonly domainAlias: boolean } {
  const cacheable = raw !== null && typeof raw === "object" && Object.isFrozen(raw);
  const hit = cacheable ? deriveFacts.get(raw as object) : undefined;
  if (hit) return hit;
  let effort = 0;
  let domainAlias = false;
  forEachDerive(raw, (def, args) => {
    effort += def.effortCost;
    for (const a of def.arguments) {
      if (a.domain && !a.type.endsWith("[]") && aliasTarget(args[a.name]) !== null) domainAlias = true;
    }
  });
  const facts = { effort, domainAlias };
  if (cacheable) deriveFacts.set(raw as object, facts);
  return facts;
}

/** The effort a full evaluation of `decls` spends, without evaluating (every derivation's cost). */
export function staticEffort(decls: ReadonlyMap<string, Decl>): number {
  let effort = 0;
  for (const d of decls.values()) effort += factsOf(d.raw).effort;
  return effort;
}

/** Whether evaluating `raw` can report OT-DRV-004: an aliased operand of an argument with a domain. */
export function hasAliasedDomainOperand(raw: Raw): boolean {
  return factsOf(raw).domainAlias;
}

/**
 * Evaluate every declaration in Kahn order. `mode` "validate" reports out-of-domain operands as
 * errors; "resolve" clamps user-dependent operands into the domain (OT-DRV-102).
 */
export function evaluate(
  decls: ReadonlyMap<string, Decl>,
  mode: "validate" | "resolve",
  userValuePaths: ReadonlySet<string> = new Set(),
): EvalResult {
  const values = new Map<string, Value>();
  const issues: EvalIssue[] = [];
  const userDependent = new Set<string>(userValuePaths);
  let effort = 0;
  const { order, cyclic } = kahnOrder(decls);

  const evalOperand = (operand: unknown, type: string, decl: Decl, depUser: { v: boolean }): Value | null => {
    const target = aliasTarget(operand);
    if (target !== null) {
      if (userDependent.has(target)) depUser.v = true;
      const v = values.get(target);
      return v ?? null;
    }
    if (isRecord(operand) && "$derive" in operand) return evalDerive(operand.$derive, decl, depUser);
    return decodeLiteral(type, operand);
  };

  const evalDerive = (derive: unknown, decl: Decl, depUser: { v: boolean }): Value | null => {
    if (!isRecord(derive)) return null;
    const def = TRANSFORMS.get(String(derive.op));
    if (!def) return null;
    effort += def.effortCost;
    if (effort > EFFORT_BUDGET) throw new EffortExceeded();
    const args = isRecord(derive.args) ? derive.args : {};
    const got: Record<string, Value | Value[] | null> = {};
    for (const a of def.arguments) {
      const operand = args[a.name];
      if (a.type.endsWith("[]")) {
        const list = Array.isArray(operand) ? operand : [];
        got[a.name] = list.map((x) => evalOperand(x, a.type.slice(0, -2), decl, depUser)!).filter((x) => x !== null);
        continue;
      }
      const local = { v: false };
      let v = evalOperand(operand, a.type, decl, local);
      if (local.v) depUser.v = true;
      if (v && v.k === "number" && a.domain && !inDomain(v.value, a.domain)) {
        if (mode === "validate" && aliasTarget(operand) !== null) {
          issues.push({ code: "OT-DRV-004", path: decl.path, document: decl.document, pointer: `${decl.pointer}/$derive/args/${a.name}` });
        }
        if (mode === "resolve" && local.v) {
          v = { k: "number", value: clampDomain(v.value, a.domain) };
          issues.push({ code: "OT-DRV-102", path: decl.path, document: decl.document, pointer: decl.pointer, params: { detail: a.name } });
        }
      }
      got[a.name] = v;
    }
    return applyOp(def.id, got);
  };

  for (const path of order) {
    const decl = decls.get(path)!;
    const depUser = { v: userDependent.has(path) };
    let v: Value | null;
    try {
      v = evalOperand(decl.raw, decl.type, decl, depUser);
    } catch (e) {
      if (e instanceof EffortExceeded) {
        issues.push({ code: "OT-DRV-007", path, document: decl.document, pointer: decl.pointer });
        break;
      }
      throw e;
    }
    if (depUser.v) userDependent.add(path);
    if (v === null) continue;
    const range = BASELINE.get(path)?.range;
    // Registry role ranges bound derivation outputs only (chapter 11, "Literal ranges").
    if (range && (v.k === "number" || v.k === "dimension") && isRecord(decl.raw) && "$derive" in decl.raw) {
      const clamped = clampDomain(v.value, range);
      if (clamped !== v.value) {
        v = { ...v, value: clamped };
        if (isRecord(decl.raw) && "$derive" in decl.raw) {
          issues.push({ code: "OT-DRV-101", path, document: decl.document, pointer: decl.pointer });
        }
      }
    }
    values.set(path, v);
  }
  for (const path of cyclic) {
    const decl = decls.get(path)!;
    issues.push({ code: "OT-REF-003", path, document: decl.document, pointer: decl.pointer });
  }
  return { values, issues, effort, userDependent };
}

function lab(v: Value | Value[] | null | undefined): Lab {
  if (!v || Array.isArray(v) || v.k !== "color") throw new Error("expected color operand");
  return v.lab;
}

function labs(v: Value | Value[] | null | undefined): Lab[] {
  return (Array.isArray(v) ? v : []).map((x) => lab(x));
}

function num(v: Value | Value[] | null | undefined): number {
  if (!v || Array.isArray(v) || (v.k !== "number" && v.k !== "dimension")) throw new Error("expected number operand");
  return v.value;
}

function dim(v: Value | Value[] | null | undefined): N.Dimension {
  return { value: num(v), unit: "px" };
}

function applyOp(id: string, a: Record<string, Value | Value[] | null>): Value | null {
  try {
    switch (id) {
      case "color.mix":
        return { k: "color", lab: C.colorMix(lab(a.color), lab(a.toward), num(a.ratio)) };
      case "color.lightness":
        return { k: "color", lab: C.colorLightness(lab(a.color), num(a.delta)) };
      case "color.chroma":
        return { k: "color", lab: C.colorChroma(lab(a.color), num(a.factor)) };
      case "color.hue":
        return { k: "color", lab: C.colorHue(lab(a.color), num(a.degrees)) };
      case "color.alpha":
        return { k: "color", lab: C.colorAlpha(lab(a.color), num(a.alpha)) };
      case "color.composite":
        return { k: "color", lab: C.colorComposite(lab(a.color), lab(a.backdrop)) };
      case "color.contrast-select":
        return { k: "color", lab: C.colorContrastSelect(labs(a.backgrounds), labs(a.candidates), num(a.target)) };
      case "color.contrast-adjust":
        return { k: "color", lab: C.colorContrastAdjust(lab(a.color), labs(a.backgrounds), num(a.target)) };
      case "color.mix-bounded":
        return {
          k: "color",
          lab: C.colorMixBounded(lab(a.color), lab(a.toward), num(a.ratio), lab(a.reference), num(a.minimum)),
        };
      case "number.scale":
        return { k: "number", value: N.numberScale(num(a.value), num(a.factor)) };
      case "number.add":
        return { k: "number", value: N.numberAdd(num(a.value), num(a.delta)) };
      case "number.clamp":
        return { k: "number", value: N.numberClamp(num(a.value), num(a.min), num(a.max)) };
      case "dimension.scale":
        return { k: "dimension", unit: "px", value: N.dimensionScale(dim(a.value), num(a.factor)).value };
      case "dimension.add":
        return { k: "dimension", unit: "px", value: N.dimensionAdd(dim(a.value), dim(a.delta)).value };
      case "dimension.clamp":
        return { k: "dimension", unit: "px", value: N.dimensionClamp(dim(a.value), dim(a.min), dim(a.max)).value };
      case "dimension.round":
        return { k: "dimension", unit: "px", value: N.dimensionRound(dim(a.value), dim(a.step)).value };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export { compatible };
