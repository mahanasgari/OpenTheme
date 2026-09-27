import { abs64, frexp, fromHex64, ldexp } from "./hex64.js";

const P0 = fromHex64("3FE55554F7DC5A64");
const P1 = fromHex64("3FD99A9E1A61AC76");
const P2 = fromHex64("3FD2187698D11CF1");
const P3 = fromHex64("3FD1046AAFEC1971");
const INV_LN2 = fromHex64("3FF71547652B82FE");
const LN2 = fromHex64("3FE62E42FEFA39EF");

/** Normative log2 (R-KRN-002). */
export function log2(x: number): number {
  if (x !== x) return x;
  if (x < 0) return Number.NaN;
  if (x === 0) return Number.NEGATIVE_INFINITY;
  if (x === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;

  const { frac, exp } = frexp(x);
  const f = abs64(frac) - 1;
  const s = f / (2 + f);
  const s2 = s * s;
  const p = P0 + s2 * (P1 + s2 * (P2 + s2 * P3));
  const ln = 2 * s + s * s2 * p;
  return exp + ln * INV_LN2;
}

/** Normative exp2 (R-KRN-003). */
export function exp2(x: number): number {
  if (x !== x) return x;
  if (x === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
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
