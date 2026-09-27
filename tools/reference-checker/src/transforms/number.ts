export type Dimension = { value: number; unit: "px" };

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

/** Round ties to even without Math.round. */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const frac = x - f;
  if (frac < 0.5) return f;
  if (frac > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

export function numberScale(value: number, factor: number): number {
  return value * factor;
}

export function numberAdd(value: number, delta: number): number {
  return value + delta;
}

export function numberClamp(value: number, min: number, max: number): number {
  return clamp(value, min, max);
}

export function dimensionScale(value: Dimension, factor: number): Dimension {
  return { value: value.value * factor, unit: "px" };
}

export function dimensionAdd(value: Dimension, delta: Dimension): Dimension {
  return { value: value.value + delta.value, unit: "px" };
}

export function dimensionClamp(
  value: Dimension,
  min: Dimension,
  max: Dimension,
): Dimension {
  return { value: clamp(value.value, min.value, max.value), unit: "px" };
}

export function dimensionRound(value: Dimension, step: Dimension): Dimension {
  const s = step.value;
  if (s <= 0) return value;
  const n = value.value / s;
  return { value: roundHalfEven(n) * s, unit: "px" };
}

/** Clamp a numeric output into an optional registry range (OT-DRV-101). */
export function clampToRange(
  value: number,
  range: { min?: number; max?: number } | undefined,
): { value: number; clamped: boolean } {
  if (!range) return { value, clamped: false };
  let v = value;
  let clamped = false;
  if (range.min !== undefined && v < range.min) {
    v = range.min;
    clamped = true;
  }
  if (range.max !== undefined && v > range.max) {
    v = range.max;
    clamped = true;
  }
  return { value: v, clamped };
}

/** Clamp an operand into a domain (OT-DRV-102 at resolution). */
export function clampToDomain(
  value: number,
  domain: { min?: number; max?: number } | undefined,
): { value: number; clamped: boolean } {
  return clampToRange(value, domain);
}

/** Validation: literal outside domain → OT-DRV-004. */
export function inDomain(
  value: number,
  domain: { min?: number; max?: number } | undefined,
): boolean {
  if (!domain) return true;
  if (domain.min !== undefined && value < domain.min) return false;
  if (domain.max !== undefined && value > domain.max) return false;
  return true;
}
