import { oklabToSrgbRaw } from "../color/oklab.js";
import { gamutMap } from "../color/gamut.js";
import { quantizeSrgb } from "../color/quantize.js";
import { colorLiteralToLab, type ConcreteValue } from "./evaluate.js";
import type { PostValue } from "./postprocess.js";

export type ResolvedTokenValue =
  | { srgb8: [number, number, number]; alpha: number }
  | { system: string }
  | { value: number; unit: string }
  | { families: string[] }
  | { number: number }
  | unknown;

export function quantizeValue(v: ConcreteValue): ResolvedTokenValue {
  if (v.kind === "color") {
    const mapped = gamutMap(v.lab);
    const q = quantizeSrgb(oklabToSrgbRaw(mapped));
    return {
      srgb8: [
        Math.round(q.r * 255),
        Math.round(q.g * 255),
        Math.round(q.b * 255),
      ],
      alpha: q.alpha,
    };
  }
  if (v.kind === "dimension") {
    return { value: v.value, unit: v.unit };
  }
  if (v.kind === "number") {
    return { number: v.value };
  }
  if (v.kind === "fontFamily") {
    return { families: v.value };
  }
  return v.value;
}

export function quantizeAll(
  values: Map<string, PostValue | ConcreteValue>,
): Map<string, ResolvedTokenValue> {
  const out = new Map<string, ResolvedTokenValue>();
  for (const [path, v] of values) {
    if (v.kind === "system") {
      out.set(path, { system: v.role });
      continue;
    }
    out.set(path, quantizeValue(v));
  }
  // Composite members are fully resolved (FR-057; finding F22): aliases are replaced by the
  // referenced token's resolved value, nested colors are quantized, and numbers are bare.
  for (const [path, v] of out) {
    if (isComposite(v)) out.set(path, resolveComposite(v, out, new Set([path])));
  }
  return out;
}

function isComposite(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && !isEncoded(v);
}

function isEncoded(v: object): boolean {
  return "srgb8" in v || "system" in v || "families" in v || "number" in v ||
    ("value" in v && "unit" in v);
}

function resolveMember(
  m: unknown,
  out: Map<string, ResolvedTokenValue>,
  seen: Set<string>,
): unknown {
  if (typeof m === "string" && /^\{[^{}]+\}$/.test(m)) {
    const target = m.slice(1, -1);
    const resolved = out.get(target);
    if (resolved === undefined || seen.has(target)) return null;
    if (isComposite(resolved)) {
      return resolveComposite(resolved, out, new Set([...seen, target]));
    }
    if (resolved && typeof resolved === "object" && "number" in resolved) {
      return (resolved as { number: number }).number;
    }
    return resolved;
  }
  if (Array.isArray(m)) {
    return m.every((x) => typeof x === "string") ? { families: m } : m;
  }
  if (m && typeof m === "object" && "colorSpace" in m) {
    const lab = colorLiteralToLab(m);
    if (lab) return quantizeValue({ kind: "color", lab });
  }
  return m;
}

function resolveComposite(
  v: Record<string, unknown>,
  out: Map<string, ResolvedTokenValue>,
  seen: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, m] of Object.entries(v)) result[k] = resolveMember(m, out, seen);
  return result;
}
