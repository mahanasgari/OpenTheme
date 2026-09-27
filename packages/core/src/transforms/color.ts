/**
 * Color transformations (chapter 04; contracts/transformations.md). Colors are OKLab with straight
 * alpha. Contrast is measured on quantized values; candidates are quantized before measuring.
 */
import { sinCosDegrees } from "../kernels/index.js";
import {
  contrastRatio,
  gamutMapOklab,
  type Lab,
  quantize,
  type Srgb8,
  srgbToOklab,
} from "../color/index.js";

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** color.mix (chapter 04): premultiplied weights c.alpha × (1 − t) and d.alpha × t. */
export function colorMix(c: Lab, toward: Lab, ratio: number): Lab {
  const t = clamp(ratio, 0, 1);
  const w0 = c.alpha * (1 - t);
  const w1 = toward.alpha * t;
  const alpha = w0 + w1;
  if (alpha === 0) return { L: 0, a: 0, b: 0, alpha: 0 };
  return {
    L: (c.L * w0 + toward.L * w1) / alpha,
    a: (c.a * w0 + toward.a * w1) / alpha,
    b: (c.b * w0 + toward.b * w1) / alpha,
    alpha,
  };
}

function mapped(L: number, a: number, b: number, alpha: number): Lab {
  const [mL, ma, mb] = gamutMapOklab(L, a, b);
  return { L: mL, a: ma, b: mb, alpha };
}

/** color.lightness: L′ = clamp(L + delta, 0, 1); chroma and hue kept; then gamut-mapped. */
export function colorLightness(c: Lab, delta: number): Lab {
  return mapped(clamp(c.L + delta, 0, 1), c.a, c.b, c.alpha);
}

/** color.chroma: a′ = a × factor, b′ = b × factor; then gamut-mapped. */
export function colorChroma(c: Lab, factor: number): Lab {
  return mapped(c.L, c.a * factor, c.b * factor, c.alpha);
}

/** color.hue: rotate (a, b) by `degrees` with the kernel sine and cosine; then gamut-mapped. */
export function colorHue(c: Lab, degrees: number): Lab {
  const [sin, cos] = sinCosDegrees(degrees);
  return mapped(c.L, c.a * cos - c.b * sin, c.a * sin + c.b * cos, c.alpha);
}

/** color.alpha: replace alpha. */
export function colorAlpha(c: Lab, alpha: number): Lab {
  return { L: c.L, a: c.a, b: c.b, alpha: clamp(alpha, 0, 1) };
}

/** color.composite: source-over of the quantized inputs in gamma-encoded sRGB (not re-quantized). */
export function colorComposite(c: Lab, backdrop: Lab): Lab {
  const s = quantize(c);
  const g = quantize(backdrop);
  const ch = (i: 0 | 1 | 2) => (s.srgb8[i] / 255) * s.alpha + (g.srgb8[i] / 255) * (1 - s.alpha);
  const [L, a, b] = srgbToOklab(ch(0), ch(1), ch(2));
  return { L, a, b, alpha: 1 };
}

export function minContrastAgainst(c: Lab, backgrounds: readonly Lab[]): number {
  const q = quantize(c);
  let min = Number.POSITIVE_INFINITY;
  for (const bg of backgrounds) {
    const ratio = contrastRatio(q, quantize(bg));
    if (ratio < min) min = ratio;
  }
  return min;
}

/** color.contrast-select: first candidate meeting target, else the most legible (earliest tie). */
export function colorContrastSelect(backgrounds: readonly Lab[], candidates: readonly Lab[], target: number): Lab {
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

const BISECT_ITERATIONS = 32;

/** color.contrast-adjust: algorithm A1 (chapter 04). */
export function colorContrastAdjust(c: Lab, backgrounds: readonly Lab[], target: number): Lab {
  if (minContrastAgainst(c, backgrounds) >= target) return c;
  const e0 = mapped(0, c.a, c.b, c.alpha);
  const e1 = mapped(1, c.a, c.b, c.alpha);
  const m0 = minContrastAgainst(e0, backgrounds);
  const m1 = minContrastAgainst(e1, backgrounds);
  const end = m0 > m1 ? e0 : m1 > m0 ? e1 : e0.L <= e1.L ? e0 : e1;
  if (minContrastAgainst(end, backgrounds) < target) return end;
  const up = end.L > c.L;
  let lo = c.L;
  let hi = end.L;
  let best = end;
  for (let i = 0; i < BISECT_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const probe = mapped(mid, c.a, c.b, c.alpha);
    if (minContrastAgainst(probe, backgrounds) >= target) {
      best = probe;
      if (up) hi = mid;
      else lo = mid;
    } else if (up) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

/** color.mix-bounded: algorithm A2 (chapter 04). */
export function colorMixBounded(c: Lab, toward: Lab, ratio: number, reference: Lab, minimum: number): Lab {
  const refs = [reference];
  const full = colorMix(c, toward, ratio);
  if (minContrastAgainst(full, refs) >= minimum) return full;
  const at0 = colorMix(c, toward, 0);
  if (minContrastAgainst(at0, refs) < minimum) return c;
  let lo = 0;
  let hi = ratio;
  let best = at0;
  for (let i = 0; i < BISECT_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2;
    const probe = colorMix(c, toward, mid);
    if (minContrastAgainst(probe, refs) >= minimum) {
      best = probe;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

export type { Srgb8 };
