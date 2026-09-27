import { abs64, copysign, frexp, fromHex64, ldexp } from "./hex64.js";

const THRESH = fromHex64("3C30000000000000"); // 2^-60
const C0 = fromHex64("3FF01B94FA5ED924");
const C1 = fromHex64("4000824969BB1DA8");
const C2 = fromHex64("C003334AEF7483EC");
const C3 = fromHex64("40008503C420852F");
const C4 = fromHex64("BFE79EAF86304017");

function floorDiv3(e: number): { q: number; r: number } {
  let q = (e / 3) | 0;
  let r = e - 3 * q;
  if (r < 0) {
    q -= 1;
    r += 3;
  }
  return { q, r };
}

/** Normative cube root (R-KRN-001). */
export function cbrt(x: number): number {
  if (x !== x || x === 0 || !Number.isFinite(x)) return x;
  const a = abs64(x);
  if (a < THRESH) return copysign(0, x);

  const { frac, exp } = frexp(a);
  const { q, r } = floorDiv3(exp);
  const m = ldexp(abs64(frac), r); // [1, 8)

  const u = (m - 1) / 7; // chapter 05 step 5: division, not a rounded 1/7 (finding F21)
  let y = C0 + u * (C1 + u * (C2 + u * (C3 + u * C4)));
  for (let i = 0; i < 3; i += 1) {
    const y2 = y * y;
    y = (2 * y + m / y2) / 3;
  }
  return copysign(ldexp(y, q), x);
}
