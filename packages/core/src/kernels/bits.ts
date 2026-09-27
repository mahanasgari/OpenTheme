/**
 * binary64 bit helpers (chapter 05, "Shared bit helpers"). Basic IEEE 754 operations only.
 */

const buffer = new DataView(new ArrayBuffer(8));

/** 16 uppercase hex digits of the big-endian bit pattern. */
export function toHex64(x: number): string {
  buffer.setFloat64(0, x);
  const hi = buffer.getUint32(0).toString(16).padStart(8, "0");
  const lo = buffer.getUint32(4).toString(16).padStart(8, "0");
  return (hi + lo).toUpperCase();
}

export function fromHex64(hex: string): number {
  buffer.setUint32(0, Number.parseInt(hex.slice(0, 8), 16));
  buffer.setUint32(4, Number.parseInt(hex.slice(8, 16), 16));
  return buffer.getFloat64(0);
}

/** 2^k for integer k in [-1022, 1023], built from the exponent field (exact). */
function pow2(k: number): number {
  buffer.setUint32(0, ((k + 1023) << 20) >>> 0);
  buffer.setUint32(4, 0);
  return buffer.getFloat64(0);
}

const TWO_1023 = pow2(1023);
const TWO_M1022 = pow2(-1022);
const TWO_53 = pow2(53);

/** Sign bit of x (true for negative, including -0). */
export function signBit(x: number): boolean {
  buffer.setFloat64(0, x);
  return (buffer.getUint32(0) & 0x80000000) !== 0;
}

export function abs(x: number): number {
  buffer.setFloat64(0, x);
  buffer.setUint32(0, buffer.getUint32(0) & 0x7fffffff);
  return buffer.getFloat64(0);
}

export function copysign(m: number, s: number): number {
  const negative = signBit(s);
  buffer.setFloat64(0, m);
  const hi = buffer.getUint32(0) & 0x7fffffff;
  buffer.setUint32(0, (negative ? hi | 0x80000000 : hi) >>> 0);
  return buffer.getFloat64(0);
}

/**
 * m × 2^e using only exponent-field arithmetic and multiplication by exact powers of two,
 * with a single final rounding in the subnormal range (no double rounding).
 */
export function ldexp(m: number, e: number): number {
  let y = m;
  let n = e;
  if (n > 1023) {
    y *= TWO_1023;
    n -= 1023;
    if (n > 1023) {
      y *= TWO_1023;
      n -= 1023;
      if (n > 1023) n = 1023;
    }
  } else if (n < -1022) {
    // Keep the final exponent below -53 so the last multiply rounds exactly once.
    y *= TWO_M1022 * TWO_53;
    n += 1022 - 53;
    if (n < -1022) {
      y *= TWO_M1022 * TWO_53;
      n += 1022 - 53;
      if (n < -1022) n = -1022;
    }
  }
  return y * pow2(n);
}

/**
 * Decompose finite nonzero |x| as frac × 2^exp with frac in [1, 2) (handles subnormals).
 */
export function decompose(x: number): { frac: number; exp: number } {
  let a = abs(x);
  let bias = 0;
  buffer.setFloat64(0, a);
  if ((buffer.getUint32(0) & 0x7ff00000) === 0) {
    a *= TWO_53 * TWO_53; // 2^106 moves any subnormal into the normal range exactly
    bias = -106;
  }
  buffer.setFloat64(0, a);
  const hi = buffer.getUint32(0);
  const exp = ((hi >>> 20) & 0x7ff) - 1023 + bias;
  buffer.setUint32(0, ((hi & 0x000fffff) | 0x3ff00000) >>> 0);
  return { frac: buffer.getFloat64(0), exp };
}

/** Round half to even on the binary64 value, without Math.round. */
export function roundHalfEven(v: number): number {
  const f = Math.floor(v);
  const diff = v - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
