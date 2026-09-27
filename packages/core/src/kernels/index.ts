/**
 * Normative numeric kernels (chapter 05; rules R-KRN-001 … R-KRN-007).
 * binary64 basic operations only; no platform math library.
 */
import { abs, copysign, decompose, fromHex64, ldexp } from "./bits.js";

export { fromHex64, roundHalfEven, toHex64 } from "./bits.js";

const TINY = fromHex64("3C30000000000000"); // 2^-60
const CBRT_P = [
  fromHex64("3FF01B94FA5ED924"),
  fromHex64("4000824969BB1DA8"),
  fromHex64("C003334AEF7483EC"),
  fromHex64("40008503C420852F"),
  fromHex64("BFE79EAF86304017"),
] as const;

export function cbrt(x: number): number {
  if (Number.isNaN(x) || x === Number.POSITIVE_INFINITY || x === Number.NEGATIVE_INFINITY || x === 0) {
    return x;
  }
  const sign = copysign(1, x);
  const a = abs(x);
  if (a < TINY) return copysign(0, x);
  const { frac, exp } = decompose(a);
  const q = Math.floor(exp / 3);
  const r = exp - 3 * q;
  const m = ldexp(frac, r);
  const u = (m - 1) / 7;
  let y = CBRT_P[4];
  y = y * u + CBRT_P[3];
  y = y * u + CBRT_P[2];
  y = y * u + CBRT_P[1];
  y = y * u + CBRT_P[0];
  for (let i = 0; i < 3; i += 1) y = (2 * y + m / (y * y)) / 3;
  return sign * ldexp(y, q);
}

const LOG2_P = [
  fromHex64("3FE55554F7DC5A64"),
  fromHex64("3FD99A9E1A61AC76"),
  fromHex64("3FD2187698D11CF1"),
  fromHex64("3FD1046AAFEC1971"),
] as const;
const INV_LN2 = fromHex64("3FF71547652B82FE");

export function log2(x: number): number {
  if (Number.isNaN(x) || x < 0) return Number.NaN;
  if (x === 0) return Number.NEGATIVE_INFINITY;
  if (x === Number.POSITIVE_INFINITY) return x;
  const { frac, exp } = decompose(x);
  const f = frac - 1;
  const s = f / (2 + f);
  const s2 = s * s;
  let p = LOG2_P[3];
  p = p * s2 + LOG2_P[2];
  p = p * s2 + LOG2_P[1];
  p = p * s2 + LOG2_P[0];
  const ln = 2 * s + s * s2 * p;
  return exp + ln * INV_LN2;
}

const LN2 = fromHex64("3FE62E42FEFA39EF");

export function exp2(x: number): number {
  if (Number.isNaN(x)) return x;
  if (x === Number.POSITIVE_INFINITY) return x;
  if (x === Number.NEGATIVE_INFINITY) return 0;
  if (x >= 1024) return Number.POSITIVE_INFINITY;
  if (x <= -1075) return 0;
  const n = Math.floor(x + 0.5);
  const f = x - n;
  const z = f * LN2;
  let sum = 1;
  let term = 1;
  for (let k = 1; k <= 10; k += 1) {
    term = (term * z) / k;
    sum = sum + term;
  }
  return ldexp(sum, n);
}

const DECODE_T = fromHex64("3FA4B5DCC63F1412");
const INV_1292 = fromHex64("3FB3D0722149B580");
const GAMMA = fromHex64("4003333333333333");
const OFFSET = fromHex64("3FAC28F5C28F5C29");
const INV_1055 = fromHex64("3FEE54EDCD0AEB60");

export function srgbDecode(c: number): number {
  if (c <= DECODE_T) return c * INV_1292;
  return exp2(GAMMA * log2((c + OFFSET) * INV_1055));
}

const ENCODE_U = fromHex64("3F69A5C37387B719");
const K1292 = fromHex64("4029D70A3D70A3D7");
const K1055 = fromHex64("3FF0E147AE147AE1");
const INV_GAMMA = fromHex64("3FDAAAAAAAAAAAAB");

export function srgbEncode(c: number): number {
  if (c <= ENCODE_U) return c * K1292;
  return K1055 * exp2(log2(c) * INV_GAMMA) - OFFSET;
}

const DEG = fromHex64("3F91DF46A2529D39");
const S0 = fromHex64("3FEFFFFFFED58092");
const S1 = fromHex64("BFC555544672ACE7");
const S2 = fromHex64("3F81107A54D6FD77");
const S3 = fromHex64("BF2997B6DF01704C");
const C0 = fromHex64("3FEFFFFFF580D854");
const C1 = fromHex64("BFDFFFFB3A765E0D");
const C2 = fromHex64("3FA55401C8A6FB6C");
const C3 = fromHex64("BF564A42AE83C185");

function polyS(x: number): number {
  const rad = x * DEG;
  const z = rad * rad;
  return rad * (S0 + z * (S1 + z * (S2 + z * S3)));
}

function polyC(x: number): number {
  const rad = x * DEG;
  const z = rad * rad;
  return C0 + z * (C1 + z * (C2 + z * C3));
}

/** Returns [sin, cos] of an angle in degrees (R-KRN-006, R-KRN-007). */
export function sinCosDegrees(d: number): [number, number] {
  const input = d === 0 ? 0 : d;
  const r = input - 360 * Math.floor(input / 360);
  if (r > 315) {
    const x = r - 360;
    return [polyS(x), polyC(x)];
  }
  if (r > 225) {
    const x = 270 - r;
    return [-polyC(x), polyS(x)];
  }
  if (r > 135) {
    const x = r - 180;
    return [-polyS(x), -polyC(x)];
  }
  if (r > 45) {
    const x = 90 - r;
    return [polyC(x), polyS(x)];
  }
  return [polyS(r), polyC(r)];
}

export function sinDegrees(d: number): number {
  return sinCosDegrees(d)[0];
}

export function cosDegrees(d: number): number {
  return sinCosDegrees(d)[1];
}

export const KERNELS = Object.freeze({
  cbrt,
  log2,
  exp2,
  "srgb-decode": srgbDecode,
  "srgb-encode": srgbEncode,
  sin: sinDegrees,
  cos: cosDegrees,
});
