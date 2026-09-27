import { parseAlias } from "../tokens/paths.js";
import {
  colorAlpha,
  colorChroma,
  colorComposite,
  colorContrastAdjust,
  colorContrastSelect,
  colorHue,
  colorLightness,
  colorMix,
  colorMixBounded,
  type ColorValue,
} from "../transforms/color.js";
import {
  dimensionAdd,
  dimensionClamp,
  dimensionRound,
  dimensionScale,
  numberAdd,
  numberClamp,
  numberScale,
} from "../transforms/number.js";
import { srgbToOklab, type Oklab } from "../color/oklab.js";
import { oklchToOklab } from "../color/oklch.js";
import { EffortCounter } from "../transforms/effort.js";
import { getTransform } from "../transforms/registry.js";
import type { Declaration } from "./declare.js";

export type ConcreteValue =
  | { kind: "color"; lab: Oklab }
  | { kind: "dimension"; value: number; unit: "px" | "ms" }
  | { kind: "number"; value: number }
  | { kind: "fontFamily"; value: string[] }
  | { kind: "other"; value: unknown };

export function colorLiteralToLab(v: unknown): Oklab | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const c = v as {
    colorSpace?: string;
    components?: number[];
    alpha?: number;
  };
  if (!c.colorSpace || !Array.isArray(c.components)) return null;
  const alpha = c.alpha ?? 1;
  if (c.colorSpace === "oklch") {
    return oklchToOklab({
      L: c.components[0] ?? 0,
      C: c.components[1] ?? 0,
      H: c.components[2] ?? 0,
      alpha,
    });
  }
  return srgbToOklab({
    r: c.components[0] ?? 0,
    g: c.components[1] ?? 0,
    b: c.components[2] ?? 0,
    alpha,
  });
}

function isDerive(v: unknown): v is { $derive: { op: string; args: Record<string, unknown> } } {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "$derive" in (v as object)
  );
}

function collectRefs(value: unknown, into: string[]): void {
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
        collectRefs(arg, into);
      }
      return;
    }
    for (const v of Object.values(obj)) collectRefs(v, into);
  }
  if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, into);
  }
}

/** Kahn topological order over declarations; ties by canonical path. */
export function kahnOrder(decls: Map<string, Declaration>): string[] {
  const paths = [...decls.keys()];
  const dependents = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const p of paths) {
    dependents.set(p, new Set());
    indegree.set(p, 0);
  }
  for (const p of paths) {
    const refs: string[] = [];
    collectRefs(decls.get(p)!.value, refs);
    for (const ref of refs) {
      if (!indegree.has(ref)) continue;
      dependents.get(ref)!.add(p);
      indegree.set(p, (indegree.get(p) ?? 0) + 1);
    }
  }
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
        let i = 0;
        while (i < ready.length && ready[i]! < q) i += 1;
        ready.splice(i, 0, q);
      }
    }
  }
  // Cycles: append remaining paths in lex order so evaluation still attempts them
  if (order.length < paths.length) {
    const remaining = paths
      .filter((p) => !order.includes(p))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    order.push(...remaining);
  }
  return order;
}

/**
 * Evaluate all declarations to concrete values using Kahn's algorithm
 * (ties broken by canonical path order), matching the Resolution Contract.
 */
export function evaluateDeclarations(
  decls: Map<string, Declaration>,
): { values: Map<string, ConcreteValue>; effort: EffortCounter; order: string[] } {
  const values = new Map<string, ConcreteValue>();
  const effort = new EffortCounter();
  const order = kahnOrder(decls);

  function resolvePath(path: string): ConcreteValue | undefined {
    if (values.has(path)) return values.get(path);
    const decl = decls.get(path);
    if (!decl) return undefined;
    const concrete = evalValue(decl.value, decl.type);
    if (concrete) values.set(path, concrete);
    return concrete;
  }

  function evalValue(raw: unknown, typeHint?: string): ConcreteValue | undefined {
    const alias = parseAlias(raw);
    if (alias) return resolvePath(alias);

    if (isDerive(raw)) {
      return evalDerive(raw.$derive);
    }

    if (typeHint === "color" || colorLiteralToLab(raw)) {
      const lab = colorLiteralToLab(raw);
      if (lab) return { kind: "color", lab };
    }

    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      "unit" in (raw as object) &&
      "value" in (raw as object)
    ) {
      const d = raw as { value: number; unit: string };
      return {
        kind: "dimension",
        value: d.value,
        unit: d.unit === "ms" ? "ms" : "px",
      };
    }

    if (typeof raw === "number") return { kind: "number", value: raw };
    if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
      return { kind: "fontFamily", value: raw as string[] };
    }
    return { kind: "other", value: raw };
  }

  function asColor(v: ConcreteValue | undefined): ColorValue | null {
    if (!v || v.kind !== "color") return null;
    return v.lab;
  }

  function evalOperand(raw: unknown): ConcreteValue | undefined {
    return evalValue(raw);
  }

  function evalDerive(derive: {
    op: string;
    args: Record<string, unknown>;
  }): ConcreteValue | undefined {
    const def = getTransform(derive.op);
    if (def) effort.add(def.effortCost);
    const args = derive.args ?? {};

    const colorArg = (name: string): ColorValue | null => {
      const c = evalOperand(args[name]);
      return asColor(c);
    };
    const numArg = (name: string): number => {
      const c = evalOperand(args[name]);
      if (c?.kind === "number") return c.value;
      if (typeof args[name] === "number") return args[name] as number;
      return 0;
    };
    const dimArg = (name: string) => {
      const c = evalOperand(args[name]);
      if (c?.kind === "dimension") return { value: c.value, unit: "px" as const };
      if (
        args[name] &&
        typeof args[name] === "object" &&
        "value" in (args[name] as object)
      ) {
        return {
          value: (args[name] as { value: number }).value,
          unit: "px" as const,
        };
      }
      return { value: 0, unit: "px" as const };
    };
    const colorList = (name: string): ColorValue[] => {
      const raw = args[name];
      if (!Array.isArray(raw)) {
        const one = colorArg(name);
        return one ? [one] : [];
      }
      return raw
        .map((item) => asColor(evalOperand(item)))
        .filter((x): x is ColorValue => x !== null);
    };

    switch (derive.op) {
      case "color.mix": {
        const a = colorArg("color");
        const b = colorArg("toward");
        if (!a || !b) return undefined;
        return { kind: "color", lab: colorMix(a, b, numArg("ratio")) };
      }
      case "color.lightness": {
        const a = colorArg("color");
        if (!a) return undefined;
        return { kind: "color", lab: colorLightness(a, numArg("delta")) };
      }
      case "color.chroma": {
        const a = colorArg("color");
        if (!a) return undefined;
        return { kind: "color", lab: colorChroma(a, numArg("factor")) };
      }
      case "color.hue": {
        const a = colorArg("color");
        if (!a) return undefined;
        return { kind: "color", lab: colorHue(a, numArg("degrees")) };
      }
      case "color.alpha": {
        const a = colorArg("color");
        if (!a) return undefined;
        return { kind: "color", lab: colorAlpha(a, numArg("alpha")) };
      }
      case "color.composite": {
        const a = colorArg("color");
        const b = colorArg("backdrop");
        if (!a || !b) return undefined;
        return { kind: "color", lab: colorComposite(a, b) };
      }
      case "color.contrast-select": {
        const bgs = colorList("backgrounds");
        const cands = colorList("candidates");
        if (bgs.length === 0 || cands.length === 0) return undefined;
        return {
          kind: "color",
          lab: colorContrastSelect(bgs, cands, numArg("target")),
        };
      }
      case "color.contrast-adjust": {
        const a = colorArg("color");
        const bgs = colorList("backgrounds");
        if (!a || bgs.length === 0) return undefined;
        return {
          kind: "color",
          lab: colorContrastAdjust(a, bgs, numArg("target")),
        };
      }
      case "color.mix-bounded": {
        const a = colorArg("color");
        const b = colorArg("toward");
        const ref = colorArg("reference");
        if (!a || !b || !ref) return undefined;
        return {
          kind: "color",
          lab: colorMixBounded(a, b, numArg("ratio"), ref, numArg("minimum")),
        };
      }
      case "number.scale":
        return {
          kind: "number",
          value: numberScale(numArg("value"), numArg("factor")),
        };
      case "number.add":
        return {
          kind: "number",
          value: numberAdd(numArg("value"), numArg("delta")),
        };
      case "number.clamp":
        return {
          kind: "number",
          value: numberClamp(numArg("value"), numArg("min"), numArg("max")),
        };
      case "dimension.scale": {
        const d = dimensionScale(dimArg("value"), numArg("factor"));
        return { kind: "dimension", value: d.value, unit: "px" };
      }
      case "dimension.add": {
        const d = dimensionAdd(dimArg("value"), dimArg("delta"));
        return { kind: "dimension", value: d.value, unit: "px" };
      }
      case "dimension.clamp": {
        const d = dimensionClamp(dimArg("value"), dimArg("min"), dimArg("max"));
        return { kind: "dimension", value: d.value, unit: "px" };
      }
      case "dimension.round": {
        const d = dimensionRound(dimArg("value"), dimArg("step"));
        return { kind: "dimension", value: d.value, unit: "px" };
      }
      default:
        return undefined;
    }
  }

  for (const p of order) resolvePath(p);

  return { values, effort, order };
}

/** Collect alias/derive dependency paths from a declaration value (for AA floor). */
export function declarationRefs(value: unknown): string[] {
  const refs: string[] = [];
  collectRefs(value, refs);
  return refs;
}
