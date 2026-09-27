/**
 * User preferences: the effective customization set and FR-044 enforcement (chapter 09).
 * Enforcement never modifies the stored value; it only decides the value used.
 */
import { fromLiteral, quantize } from "../color/index.js";
import { jcs } from "../canonical/jcs.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { isRecord, type ThemeModel } from "../engine/model.js";
import { STANDARD_POINTS } from "../engine/registry.js";
import { colorLiteral } from "../engine/values.js";
import { shapeOf } from "../validate/grammar.js";

export type PreferenceStatus = "effective" | "clamped" | "fell-back" | "skipped" | "rejected";

export interface EffectivePoint {
  readonly id: string;
  /** Policy narrowing excluded the documented default without a replacement (chapter 09). */
  readonly unusable?: boolean;
  readonly type: string;
  /** Token paths, or a dimension name, or "textScale". */
  readonly target: readonly string[] | { readonly dimension: string } | { readonly textScale: string };
  readonly constraints: Readonly<Record<string, unknown>> | undefined;
  readonly default: unknown;
  readonly effectiveRange?: { readonly min: number; readonly max: number };
}

export interface EnforcedPreference {
  readonly point: EffectivePoint;
  readonly status: PreferenceStatus;
  /** The value used (after clamping or fallback), or the stored value when rejected. */
  readonly value?: unknown;
}

export function pointsOf(model: ThemeModel): Map<string, Readonly<Record<string, unknown>>> {
  const out = new Map<string, Readonly<Record<string, unknown>>>();
  for (const p of model.points) if (typeof p.id === "string") out.set(p.id, p);
  return out;
}

export function declaredPointIds(model: ThemeModel): Set<string> {
  return new Set(pointsOf(model).keys());
}

/** Theme-declared points ∩ permitted points, with policy narrowing (FR-043). */
export function effectivePoints(
  model: ThemeModel,
  permitted: Readonly<Record<string, unknown>> | undefined,
  c: DiagnosticCollector,
): Map<string, EffectivePoint> {
  const out = new Map<string, EffectivePoint>();
  if (!permitted) return out;
  for (const [pid, decl] of pointsOf(model)) {
    if (!(pid in permitted)) continue;
    const std = STANDARD_POINTS.get(pid);
    const narrow = isRecord(permitted[pid]) ? (permitted[pid] as Record<string, unknown>) : {};
    const constraints = (narrow.constraints ?? decl.constraints ?? std?.constraints) as Record<string, unknown> | undefined;
    const type = String(decl.type ?? std?.type ?? "");
    const target = (decl.target ?? std?.target ?? []) as EffectivePoint["target"];
    let unusable = false;
    const dflt =
      narrow.default !== undefined
        ? narrow.default
        : decl.default !== undefined && decl.default !== null
          ? decl.default
          : std?.default;
    const effectiveRange = (decl.effectiveRange ?? std?.effectiveRange) as EffectivePoint["effectiveRange"];
    if (narrow.constraints !== undefined && narrow.default === undefined && dflt !== undefined && dflt !== null) {
      if (!satisfies(type, constraints, dflt)) {
        c.add("OT-CUS-001", { document: "input", pointer: `/policy/permittedPoints/${pid}` });
        unusable = true;
      }
    }
    // The color-scheme point offers the theme's supported schemes, variants included.
    const cons =
      pid === "std.color-scheme" && narrow.constraints === undefined ? { enum: [...model.supportedSchemes] } : constraints;
    out.set(pid, {
      id: pid,
      type,
      target,
      constraints: cons,
      default: dflt,
      ...(unusable ? { unusable } : {}),
      ...(effectiveRange ? { effectiveRange } : {}),
    });
  }
  return out;
}

function satisfies(type: string, cons: Readonly<Record<string, unknown>> | undefined, v: unknown): boolean {
  if (!cons) return true;
  const range = isRecord(cons.range) ? cons.range : undefined;
  if (range && typeof range.min === "number" && typeof range.max === "number") {
    const n = typeof v === "number" ? v : isRecord(v) && typeof v.value === "number" ? v.value : undefined;
    return n !== undefined && n >= range.min && n <= range.max;
  }
  if (Array.isArray(cons.enum)) return cons.enum.some((e) => jcs(e) === jcs(v));
  if (Array.isArray(cons.presets)) return cons.presets.some((p) => isRecord(p) && jcs(p.value) === jcs(v));
  return shapeOf(type, v);
}

function wellFormed(type: string, v: unknown): boolean {
  if (type === "enum") return typeof v === "string";
  if (type === "color") return colorLiteral(v) !== null;
  return shapeOf(type, v);
}

/** Clamp to [min, max], then snap to the nearest step from min, ties to the lower value. */
function clampSnap(n: number, min: number, max: number, step: number | undefined): number {
  let v = n < min ? min : n > max ? max : n;
  if (step && step > 0) {
    const k = (v - min) / step;
    const lo = Math.floor(k);
    const idx = k - lo > 0.5 ? lo + 1 : lo;
    v = min + idx * step;
    if (v > max) v = max;
  }
  return v;
}

export function enforce(point: EffectivePoint, value: unknown): EnforcedPreference {
  const fallback = (): EnforcedPreference => ({ point, status: "fell-back", value: point.default });
  if (!wellFormed(point.type, value)) return fallback();
  const cons = point.constraints;
  const range = cons && isRecord(cons.range) ? cons.range : undefined;
  if (range && point.type === "color") {
    // Gamut-mapped, quantized to 8-bit sRGB, alpha 1; clamped when that changes the value.
    const q = quantize(fromLiteral(colorLiteral(value)!));
    const used = { colorSpace: "srgb", components: q.srgb8.map((x) => x / 255), alpha: 1 };
    return { point, status: jcs(used) === jcs(value) ? "effective" : "clamped", value: used };
  }
  if (range && typeof range.min === "number" && typeof range.max === "number") {
    const step = typeof range.step === "number" ? range.step : undefined;
    if (typeof value === "number") {
      const v = clampSnap(value, range.min, range.max, step);
      return { point, status: v === value ? "effective" : "clamped", value: v };
    }
    if (isRecord(value) && typeof value.value === "number") {
      const v = clampSnap(value.value, range.min, range.max, step);
      return { point, status: v === value.value ? "effective" : "clamped", value: { ...value, value: v } };
    }
    return fallback();
  }
  if (cons && (Array.isArray(cons.enum) || Array.isArray(cons.presets))) {
    return satisfies(point.type, cons, value) ? { point, status: "effective", value } : fallback();
  }
  return { point, status: "effective", value };
}
