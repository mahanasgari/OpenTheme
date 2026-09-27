/**
 * Regression for finding F16: ldexp scaled by 2^61 per 60-exponent step, and subnormal frexp
 * started at -1022. Platform math is used here only as an independent oracle in a test.
 */
import { describe, expect, it } from "vitest";
import { cbrt, exp2, frexp, ldexp, log2 } from "../../../src/kernels/index.js";

function relErr(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b);
}

describe("kernel edge magnitudes (F16)", () => {
  it("ldexp is exact for large exponents", () => {
    expect(ldexp(1, 60)).toBe(2 ** 60);
    expect(ldexp(1, 1023)).toBe(2 ** 1023);
    expect(ldexp(1.5, 300)).toBe(1.5 * 2 ** 300);
    expect(ldexp(1, -1074)).toBe(Number.MIN_VALUE);
  });

  it("frexp normalizes subnormals to the true exponent", () => {
    expect(frexp(Number.MIN_VALUE)).toEqual({ frac: 1, exp: -1074 });
    expect(frexp(2 ** -1030).exp).toBe(-1030);
  });

  it("cbrt, log2, and exp2 agree with the true value at extreme magnitudes", () => {
    expect(relErr(cbrt(Number.MAX_VALUE), Math.cbrt(Number.MAX_VALUE))).toBeLessThan(1e-15);
    expect(relErr(cbrt(2.4014363114599495e54), Math.cbrt(2.4014363114599495e54))).toBeLessThan(1e-15);
    expect(log2(Number.MIN_VALUE)).toBe(-1074);
    expect(relErr(exp2(63.40852130325811), 2 ** 63.40852130325811)).toBeLessThan(1e-12);
    expect(relErr(exp2(1000.5), 2 ** 1000.5)).toBeLessThan(1e-12);
  });
});
