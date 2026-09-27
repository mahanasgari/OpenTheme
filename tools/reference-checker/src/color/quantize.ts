/** Round ties to even without Math.round. */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const frac = x - f;
  if (frac < 0.5) return f;
  if (frac > 0.5) return f + 1;
  // exact half: toward even
  return f % 2 === 0 ? f : f + 1;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** Quantize a channel in [0,1] to 8-bit sRGB (round half even). */
export function quantizeChannel(c: number): number {
  return roundHalfEven(clamp01(c) * 255) / 255;
}

/** Quantize alpha to thousandths (round half even). */
export function quantizeAlpha(a: number): number {
  return roundHalfEven(clamp01(a) * 1000) / 1000;
}

export type QuantizedSrgb = {
  r: number;
  g: number;
  b: number;
  alpha: number;
};

export function quantizeSrgb(c: {
  r: number;
  g: number;
  b: number;
  alpha: number;
}): QuantizedSrgb {
  return {
    r: quantizeChannel(c.r),
    g: quantizeChannel(c.g),
    b: quantizeChannel(c.b),
    alpha: quantizeAlpha(c.alpha),
  };
}
