import { gamutMap } from "../color/gamut.js";
import { oklabToSrgbRaw, srgbToOklab, type Oklab } from "../color/oklab.js";
import { oklchToOklab } from "../color/oklch.js";
import { quantizeSrgb } from "../color/quantize.js";

export type EnforceStatus = "unchanged" | "clamped" | "fallback";

export type EffectiveConstraints =
  | {
      kind: "range";
      min: number;
      max: number;
      step?: number;
    }
  | {
      kind: "color";
      gamut: "srgb";
      opaque: true;
    }
  | {
      kind: "enum";
      values: unknown[];
    }
  | {
      kind: "presets";
      values: unknown[];
    };

export interface EnforceResult {
  status: EnforceStatus;
  value: unknown;
  diagnostic: "OT-CUS-101" | "OT-CUS-102" | null;
}

function snapToStep(value: number, min: number, step: number): number {
  const n = (value - min) / step;
  const lo = Math.floor(n);
  const hi = Math.ceil(n);
  if (lo === hi) return min + lo * step;
  const dLo = n - lo;
  const dHi = hi - n;
  // Ties to the lower step
  if (dLo <= dHi) return min + lo * step;
  return min + hi * step;
}

function isColorObject(v: unknown): v is {
  colorSpace: string;
  components: number[];
  alpha?: number;
} {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as { colorSpace?: string }).colorSpace === "string" &&
    Array.isArray((v as { components?: unknown }).components)
  );
}

function toOklab(c: {
  colorSpace: string;
  components: number[];
  alpha?: number;
}): Oklab {
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

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * FR-044 enforcement: clamp/snap/gamut-map or fall back to the documented
 * default. Never mutates the input value.
 */
export function enforcePreference(
  value: unknown,
  constraints: EffectiveConstraints,
  documentedDefault: unknown,
): EnforceResult {
  // Work on a structural copy so callers can assert non-mutation.
  const inputSnapshot = value;

  if (constraints.kind === "range") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return {
        status: "fallback",
        value: documentedDefault,
        diagnostic: "OT-CUS-102",
      };
    }
    let v = value;
    let changed = false;
    if (v < constraints.min) {
      v = constraints.min;
      changed = true;
    }
    if (v > constraints.max) {
      v = constraints.max;
      changed = true;
    }
    if (constraints.step !== undefined && constraints.step > 0) {
      const snapped = snapToStep(v, constraints.min, constraints.step);
      if (snapped !== v) {
        v = snapped;
        changed = true;
      }
    }
    // Keep within bounds after snap
    if (v < constraints.min) v = constraints.min;
    if (v > constraints.max) v = constraints.max;
    void inputSnapshot;
    return changed
      ? { status: "clamped", value: v, diagnostic: "OT-CUS-101" }
      : { status: "unchanged", value: v, diagnostic: null };
  }

  if (constraints.kind === "color") {
    if (!isColorObject(value)) {
      return {
        status: "fallback",
        value: documentedDefault,
        diagnostic: "OT-CUS-102",
      };
    }
    // Copy components so we never mutate the caller's object
    const copy: {
      colorSpace: string;
      components: number[];
      alpha?: number;
    } = {
      colorSpace: value.colorSpace,
      components: [...value.components],
    };
    if (value.alpha !== undefined) copy.alpha = value.alpha;
    const lab = toOklab(copy);
    const mapped = gamutMap({ ...lab, alpha: 1 });
    const srgb = quantizeSrgb(oklabToSrgbRaw(mapped));
    const out = {
      colorSpace: "srgb" as const,
      components: [srgb.r, srgb.g, srgb.b],
      alpha: 1,
    };
    const same =
      copy.colorSpace === "srgb" &&
      copy.alpha === 1 &&
      Math.abs((copy.components[0] ?? 0) - srgb.r) < 1e-12 &&
      Math.abs((copy.components[1] ?? 0) - srgb.g) < 1e-12 &&
      Math.abs((copy.components[2] ?? 0) - srgb.b) < 1e-12;
    return same
      ? { status: "unchanged", value: out, diagnostic: null }
      : { status: "clamped", value: out, diagnostic: "OT-CUS-101" };
  }

  if (constraints.kind === "enum" || constraints.kind === "presets") {
    const allowed = constraints.values;
    const ok = allowed.some((a) => deepEqual(a, value));
    if (ok) {
      return { status: "unchanged", value, diagnostic: null };
    }
    return {
      status: "fallback",
      value: documentedDefault,
      diagnostic: "OT-CUS-102",
    };
  }

  return {
    status: "fallback",
    value: documentedDefault,
    diagnostic: "OT-CUS-102",
  };
}
