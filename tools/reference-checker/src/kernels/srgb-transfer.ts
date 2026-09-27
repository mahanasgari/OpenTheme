import { fromHex64 } from "./hex64.js";
import { exp2, log2 } from "./log2-exp2.js";

const T_DECODE = fromHex64("3FA4B5DCC63F1412"); // 0.04045
const INV_12_92 = fromHex64("3FB3D0722149B580");
const C_0_055 = fromHex64("3FAC28F5C28F5C29");
const INV_1_055 = fromHex64("3FEE54EDCD0AEB60");
const EXP_24 = fromHex64("4003333333333333"); // 2.4

const T_ENCODE = fromHex64("3F69A5C37387B719"); // 0.0031308
const C_12_92 = fromHex64("4029D70A3D70A3D7");
const C_1_055 = fromHex64("3FF0E147AE147AE1");
const INV_24 = fromHex64("3FDAAAAAAAAAAAAB"); // 1/2.4

/** Normative sRGB decode (R-KRN-004). */
export function srgbDecode(c: number): number {
  if (c <= T_DECODE) return c * INV_12_92;
  return exp2(EXP_24 * log2((c + C_0_055) * INV_1_055));
}

/** Normative sRGB encode (R-KRN-005). */
export function srgbEncode(c: number): number {
  if (c <= T_ENCODE) return c * C_12_92;
  return C_1_055 * exp2(log2(c) * INV_24) - C_0_055;
}
