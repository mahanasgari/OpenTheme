import {
  oklabToLinearSrgb,
  type Oklab,
  linearSrgbToOklab,
} from "./oklab.js";
import { deltaE } from "./oklch.js";

const JND = 0.02;
const ITERATIONS = 24;

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** True when linear sRGB channels all lie in [0, 1]. */
export function isInGamut(c: Oklab): boolean {
  const lin = oklabToLinearSrgb(c);
  return (
    lin.r >= 0 &&
    lin.r <= 1 &&
    lin.g >= 0 &&
    lin.g <= 1 &&
    lin.b >= 0 &&
    lin.b <= 1
  );
}

/** Clip to sRGB gamut by clamping linear channels, then convert back to OKLab. */
export function clipToGamut(c: Oklab): Oklab {
  const lin = oklabToLinearSrgb(c);
  return linearSrgbToOklab(
    clamp01(lin.r),
    clamp01(lin.g),
    clamp01(lin.b),
    c.alpha,
  );
}

/**
 * CSS Color 4–style OKLCH chroma reduction with JND 0.02 and exactly 24
 * iterations. Chroma is reduced by scaling (a, b). The result is always in gamut
 * (final clip step).
 */
export function gamutMap(c: Oklab): Oklab {
  let L = c.L;
  if (L < 0) L = 0;
  if (L > 1) L = 1;
  const start: Oklab = { L, a: c.a, b: c.b, alpha: c.alpha };

  if (isInGamut(start)) return start;

  const clipped0 = clipToGamut(start);
  if (deltaE(clipped0, start) < JND) return clipped0;

  let lo = 0;
  let hi = 1;
  let best = clipped0;

  for (let i = 0; i < ITERATIONS; i += 1) {
    const t = (lo + hi) / 2;
    const candidate: Oklab = {
      L,
      a: start.a * t,
      b: start.b * t,
      alpha: c.alpha,
    };
    if (isInGamut(candidate)) {
      best = candidate;
      lo = t;
      continue;
    }
    const clipped = clipToGamut(candidate);
    if (deltaE(clipped, candidate) < JND) {
      best = clipped;
      lo = t;
    } else {
      hi = t;
    }
  }
  return isInGamut(best) ? best : clipToGamut(best);
}
