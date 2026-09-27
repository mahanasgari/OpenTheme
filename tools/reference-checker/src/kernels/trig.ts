import { fromHex64 } from "./hex64.js";

const DEG2RAD = fromHex64("3F91DF46A2529D39");
const S0 = fromHex64("3FEFFFFFFED58092");
const S1 = fromHex64("BFC555544672ACE7");
const S2 = fromHex64("3F81107A54D6FD77");
const S3 = fromHex64("BF2997B6DF01704C");
const C0 = fromHex64("3FEFFFFFF580D854");
const C1 = fromHex64("BFDFFFFB3A765E0D");
const C2 = fromHex64("3FA55401C8A6FB6C");
const C3 = fromHex64("BF564A42AE83C185");

function reduceDegrees(d: number): number {
  if (d !== d || !Number.isFinite(d)) return d;
  if (d === 0) return 0;
  return d - 360 * Math.floor(d / 360);
}

function evalSinCos(xDeg: number): { s: number; c: number } {
  const rad = xDeg * DEG2RAD;
  const z = rad * rad;
  const s = rad * (S0 + z * (S1 + z * (S2 + z * S3)));
  const c = C0 + z * (C1 + z * (C2 + z * C3));
  return { s, c };
}

function sinCosDegrees(d: number): { sin: number; cos: number } {
  if (d !== d || !Number.isFinite(d)) return { sin: d, cos: d };
  const r = reduceDegrees(d);
  if (r > 315) {
    const { s, c } = evalSinCos(r - 360);
    return { sin: s, cos: c };
  }
  if (r > 225) {
    const { s, c } = evalSinCos(270 - r);
    return { sin: -c, cos: s };
  }
  if (r > 135) {
    const { s, c } = evalSinCos(r - 180);
    return { sin: -s, cos: -c };
  }
  if (r > 45) {
    const { s, c } = evalSinCos(90 - r);
    return { sin: c, cos: s };
  }
  const { s, c } = evalSinCos(r);
  return { sin: s, cos: c };
}

/** Normative sine of degrees (R-KRN-006). */
export function sin(d: number): number {
  return sinCosDegrees(d).sin;
}

/** Normative cosine of degrees (R-KRN-007). */
export function cos(d: number): number {
  return sinCosDegrees(d).cos;
}
