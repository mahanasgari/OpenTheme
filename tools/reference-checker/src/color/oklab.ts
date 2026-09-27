import { fromHex64 } from "../kernels/hex64.js";
import { cbrt } from "../kernels/cbrt.js";
import { srgbDecode, srgbEncode } from "../kernels/srgb-transfer.js";

/** Premultiplied OKLab color with alpha in [0, 1]. */
export type Oklab = { L: number; a: number; b: number; alpha: number };

/** Gamma-encoded sRGB in [0, 1] with alpha. */
export type Srgb = { r: number; g: number; b: number; alpha: number };

const LMS_R = [
  fromHex64("3FDA61D629F2E197"),
  fromHex64("3FE129A2D9E60E32"),
  fromHex64("3FAA572112081026"),
] as const;
const LMS_G = [
  fromHex64("3FCB1FA76156A7C5"),
  fromHex64("3FE5C84A69936914"),
  fromHex64("3FBB7E5DF0497455"),
] as const;
const LMS_B = [
  fromHex64("3FB69AFD7A044C17"),
  fromHex64("3FD207AE728A2F45"),
  fromHex64("3FE428C9177A5EDB"),
] as const;

const LAB_L = [
  fromHex64("3FCAF02A3FE8A4FA"),
  fromHex64("3FE9655120032AAD"),
  fromHex64("BF70ADD9BD572B38"),
] as const;
const LAB_A = [
  fromHex64("3FFFA5E1BFFFDE12"),
  fromHex64("C0036DC1BFFE5D3E"),
  fromHex64("3FDCD686FFF371A5"),
] as const;
const LAB_B = [
  fromHex64("3F9A869680B729E0"),
  fromHex64("3FE90C776001F502"),
  fromHex64("BFE9E0AC0001353D"),
] as const;

const LMS_FROM_L = [
  fromHex64("3FF0000000000000"),
  fromHex64("3FD95D9920068C8A"),
  fromHex64("3FCB9F751FFA8CC8"),
] as const;
const LMS_FROM_A = [
  fromHex64("3FF0000000000000"),
  fromHex64("BFBB06117FEEC881"),
  fromHex64("BFB058BF3FE39E34"),
] as const;
const LMS_FROM_B = [
  fromHex64("3FF0000000000000"),
  fromHex64("BFB6E86F5FDF38B5"),
  fromHex64("BFF4A9ECBFFEAA8D"),
] as const;

const RGB_FROM_L = [
  fromHex64("40104E955DC3D73A"),
  fromHex64("C00A76317EA9DE73"),
  fromHex64("3FCD906C3222FFEF"),
] as const;
const RGB_FROM_M = [
  fromHex64("BFF44B85A62C2AFF"),
  fromHex64("4004E0C87D01BF65"),
  fromHex64("BFD5D82D4F5D4F2A"),
] as const;
const RGB_FROM_S = [
  fromHex64("BF712FEA56E00671"),
  fromHex64("BFE68267C131178D"),
  fromHex64("3FFB5263CAEF6BCD"),
] as const;

function dot3(
  row: readonly [number, number, number],
  x: number,
  y: number,
  z: number,
): number {
  return row[0] * x + row[1] * y + row[2] * z;
}

/** Linear sRGB → OKLab. */
export function linearSrgbToOklab(
  r: number,
  g: number,
  b: number,
  alpha = 1,
): Oklab {
  const l = dot3(LMS_R, r, g, b);
  const m = dot3(LMS_G, r, g, b);
  const s = dot3(LMS_B, r, g, b);
  const lp = cbrt(l);
  const mp = cbrt(m);
  const sp = cbrt(s);
  return {
    L: dot3(LAB_L, lp, mp, sp),
    a: dot3(LAB_A, lp, mp, sp),
    b: dot3(LAB_B, lp, mp, sp),
    alpha,
  };
}

/** OKLab → linear sRGB (may be out of gamut). */
export function oklabToLinearSrgb(c: Oklab): {
  r: number;
  g: number;
  b: number;
  alpha: number;
} {
  const lp = dot3(LMS_FROM_L, c.L, c.a, c.b);
  const mp = dot3(LMS_FROM_A, c.L, c.a, c.b);
  const sp = dot3(LMS_FROM_B, c.L, c.a, c.b);
  const l = lp * lp * lp;
  const m = mp * mp * mp;
  const s = sp * sp * sp;
  return {
    r: dot3(RGB_FROM_L, l, m, s),
    g: dot3(RGB_FROM_M, l, m, s),
    b: dot3(RGB_FROM_S, l, m, s),
    alpha: c.alpha,
  };
}

/** Gamma-encoded sRGB → OKLab. */
export function srgbToOklab(c: Srgb): Oklab {
  return linearSrgbToOklab(
    srgbDecode(c.r),
    srgbDecode(c.g),
    srgbDecode(c.b),
    c.alpha,
  );
}

/** OKLab → gamma-encoded sRGB without gamut mapping (channels may leave [0,1]). */
export function oklabToSrgbRaw(c: Oklab): Srgb {
  const lin = oklabToLinearSrgb(c);
  return {
    r: srgbEncode(lin.r),
    g: srgbEncode(lin.g),
    b: srgbEncode(lin.b),
    alpha: c.alpha,
  };
}
