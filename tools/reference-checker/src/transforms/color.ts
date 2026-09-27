import { cos, sin } from "../kernels/trig.js";
import type { Oklab } from "../color/oklab.js";
import { oklabToSrgbRaw, srgbToOklab } from "../color/oklab.js";
import { gamutMap } from "../color/gamut.js";
import { quantizeSrgb } from "../color/quantize.js";
import { contrastRatio, meetsContrast } from "../color/contrast.js";
import { compositeSourceOver } from "../color/composite.js";

export type ColorValue = Oklab;

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

export function toQuantizedSrgb(c: ColorValue) {
  const mapped = gamutMap(c);
  return quantizeSrgb(oklabToSrgbRaw(mapped));
}

export function minContrastAgainst(
  color: ColorValue,
  backgrounds: ColorValue[],
): number {
  const fg = toQuantizedSrgb(color);
  let min = Number.POSITIVE_INFINITY;
  for (const bg of backgrounds) {
    const q = toQuantizedSrgb(bg);
    const r = contrastRatio(fg, q);
    if (r < min) min = r;
  }
  return min;
}

export function meetsAllBackgrounds(
  color: ColorValue,
  backgrounds: ColorValue[],
  target: number,
): boolean {
  const fg = toQuantizedSrgb(color);
  for (const bg of backgrounds) {
    if (!meetsContrast(fg, toQuantizedSrgb(bg), target)) return false;
  }
  return true;
}

/** Premultiplied OKLab mix. */
export function colorMix(
  color: ColorValue,
  toward: ColorValue,
  ratio: number,
): ColorValue {
  const t = clamp(ratio, 0, 1);
  const a0 = color.alpha;
  const a1 = toward.alpha;
  const pa0 = a0 * (1 - t);
  const pa1 = a1 * t;
  const a = pa0 + pa1;
  if (a === 0) return { L: 0, a: 0, b: 0, alpha: 0 };
  return {
    L: (color.L * pa0 + toward.L * pa1) / a,
    a: (color.a * pa0 + toward.a * pa1) / a,
    b: (color.b * pa0 + toward.b * pa1) / a,
    alpha: a,
  };
}

export function colorLightness(color: ColorValue, delta: number): ColorValue {
  return gamutMap({
    L: clamp(color.L + delta, 0, 1),
    a: color.a,
    b: color.b,
    alpha: color.alpha,
  });
}

export function colorChroma(color: ColorValue, factor: number): ColorValue {
  return gamutMap({
    L: color.L,
    a: color.a * factor,
    b: color.b * factor,
    alpha: color.alpha,
  });
}

export function colorHue(color: ColorValue, degrees: number): ColorValue {
  const c = cos(degrees);
  const s = sin(degrees);
  return gamutMap({
    L: color.L,
    a: color.a * c - color.b * s,
    b: color.a * s + color.b * c,
    alpha: color.alpha,
  });
}

export function colorAlpha(color: ColorValue, alpha: number): ColorValue {
  return { L: color.L, a: color.a, b: color.b, alpha: clamp(alpha, 0, 1) };
}

export function colorComposite(
  color: ColorValue,
  backdrop: ColorValue,
): ColorValue {
  const src = toQuantizedSrgb(color);
  const bg = toQuantizedSrgb(backdrop);
  const out = compositeSourceOver(src, bg);
  return srgbToOklab(out);
}

export function colorContrastSelect(
  backgrounds: ColorValue[],
  candidates: ColorValue[],
  target: number,
): ColorValue {
  let best = candidates[0]!;
  let bestMin = minContrastAgainst(best, backgrounds);
  for (const cand of candidates) {
    const m = minContrastAgainst(cand, backgrounds);
    if (m >= target) return cand;
    if (m > bestMin) {
      bestMin = m;
      best = cand;
    }
  }
  return best;
}

/** Algorithm A1. */
export function colorContrastAdjust(
  color: ColorValue,
  backgrounds: ColorValue[],
  target: number,
): ColorValue {
  if (meetsAllBackgrounds(color, backgrounds, target)) return color;

  const end0 = gamutMap({ L: 0, a: color.a, b: color.b, alpha: color.alpha });
  const end1 = gamutMap({ L: 1, a: color.a, b: color.b, alpha: color.alpha });
  const min0 = minContrastAgainst(end0, backgrounds);
  const min1 = minContrastAgainst(end1, backgrounds);

  let endpoint: ColorValue;
  if (min0 > min1) endpoint = end0;
  else if (min1 > min0) endpoint = end1;
  else endpoint = end0.L <= end1.L ? end0 : end1; // darker on a tie

  if (!meetsAllBackgrounds(endpoint, backgrounds, target)) return endpoint;

  // Bisect lightness between input and endpoint for exactly 32 iterations.
  let lo = color.L;
  let hi = endpoint.L;
  let bestPassing = endpoint;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < 32; i += 1) {
    const midL = (lo + hi) / 2;
    const probe = gamutMap({
      L: midL,
      a: color.a,
      b: color.b,
      alpha: color.alpha,
    });
    // Quantize via contrast check path
    if (meetsAllBackgrounds(probe, backgrounds, target)) {
      bestPassing = probe;
      const dist = midL < color.L ? color.L - midL : midL - color.L;
      if (dist < bestDist) bestDist = dist;
      // Move toward input
      if (endpoint.L > color.L) hi = midL;
      else lo = midL;
    } else if (endpoint.L > color.L) {
      lo = midL;
    } else {
      hi = midL;
    }
  }
  return bestPassing;
}

/** Algorithm A2. */
export function colorMixBounded(
  color: ColorValue,
  toward: ColorValue,
  ratio: number,
  reference: ColorValue,
  minimum: number,
): ColorValue {
  const atRatio = colorMix(color, toward, ratio);
  if (meetsAllBackgrounds(atRatio, [reference], minimum)) return atRatio;
  const at0 = colorMix(color, toward, 0);
  if (!meetsAllBackgrounds(at0, [reference], minimum)) return color;

  let lo = 0;
  let hi = ratio;
  let best = at0;
  for (let i = 0; i < 32; i += 1) {
    const mid = (lo + hi) / 2;
    const probe = colorMix(color, toward, mid);
    if (meetsAllBackgrounds(probe, [reference], minimum)) {
      best = probe;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}
