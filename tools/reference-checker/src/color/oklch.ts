import { cos, sin } from "../kernels/trig.js";
import type { Oklab } from "./oklab.js";

export type Oklch = { L: number; C: number; H: number; alpha: number };

/** OKLCH → OKLab using kernel sine/cosine. H is degrees. */
export function oklchToOklab(c: Oklch): Oklab {
  return {
    L: c.L,
    a: c.C * cos(c.H),
    b: c.C * sin(c.H),
    alpha: c.alpha,
  };
}

/** Chroma of an OKLab color (no hue). */
export function oklabChroma(c: Oklab): number {
  return Math.sqrt(c.a * c.a + c.b * c.b);
}

/** Euclidean OKLab ΔE (JND uses this). */
export function deltaE(a: Oklab, b: Oklab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
