/** IEEE 754 binary64 ↔ uppercase hex helpers (chapter 05). */

const buf = new ArrayBuffer(8);
const view = new DataView(buf);

function bitsToFloat(bits: bigint): number {
  view.setBigUint64(0, bits, false);
  return view.getFloat64(0, false);
}

const TWO_60 = bitsToFloat(0x43b0000000000000n); // 2^60 (was 2^61: finding F16)
const TWO_NEG_60 = bitsToFloat(0x3c30000000000000n);

export function toBits(x: number): bigint {
  view.setFloat64(0, x, false);
  return view.getBigUint64(0, false);
}

export function fromBits(bits: bigint): number {
  return bitsToFloat(bits);
}

export function toHex64(x: number): string {
  return toBits(x).toString(16).toUpperCase().padStart(16, "0");
}

export function fromHex64(hex: string): number {
  if (!/^[0-9A-Fa-f]{16}$/.test(hex)) {
    throw new Error(`invalid hex64: ${hex}`);
  }
  return fromBits(BigInt(`0x${hex}`));
}

export function abs64(x: number): number {
  return fromBits(toBits(x) & 0x7fffffffffffffffn);
}

export function copysign(magnitude: number, signSource: number): number {
  const mag = toBits(magnitude) & 0x7fffffffffffffffn;
  const sign = toBits(signSource) & 0x8000000000000000n;
  return fromBits(mag | sign);
}

const MIN_NORMAL = fromBits(0x0010000000000000n); // 2^-1022

/** 2^k for k in [-1022, 1023], built from the exponent field. */
function pow2(k: number): number {
  return fromBits(BigInt(k + 1023) << 52n);
}

/**
 * `m × 2^exp` rounded once (chapter 05): exact scaling while the result stays normal, then a
 * single multiply, so a subnormal result is not double-rounded (finding F32).
 */
export function ldexp(m: number, exp: number): number {
  if (m === 0 || !Number.isFinite(m) || exp === 0) return m;
  let v = m;
  let e = exp | 0;
  while (e >= 60) {
    v = v * TWO_60;
    e -= 60;
    if (!Number.isFinite(v)) return v;
  }
  while (e > 0) {
    v = v * 2;
    e -= 1;
  }
  while (e <= -60 && abs64(v) >= MIN_NORMAL * TWO_60) {
    v = v * TWO_NEG_60;
    e += 60;
  }
  if (e === 0) return v;
  if (e >= -1022) return v * pow2(e);
  // |v| < 2^-962 here, so |v| × 2^e < 2^-1984: the correctly rounded result is zero.
  return copysign(0, v);
}

/** Unbiased exponent and significand in [1, 2) for finite nonzero values. */
export function frexp(x: number): { frac: number; exp: number } {
  const a = abs64(x);
  if (a === 0 || !Number.isFinite(a)) return { frac: x, exp: 0 };
  const bits = toBits(a);
  const expField = Number((bits >> 52n) & 0x7ffn);
  const fracBits = bits & 0x000fffffffffffffn;
  if (expField === 0) {
    // Subnormal: each exact doubling lowers the exponent by one, starting from 2^0 (F16).
    let v = a;
    let unbiased = 0;
    while (v < 1) {
      v = v * 2;
      unbiased -= 1;
    }
    return { frac: copysign(v, x), exp: unbiased };
  }
  const frac = fromBits(0x3ff0000000000000n | fracBits);
  return { frac: copysign(frac, x), exp: expField - 1023 };
}
