export { toHex64, fromHex64, toBits, fromBits, abs64, copysign, ldexp, frexp } from "./hex64.js";
export { cbrt } from "./cbrt.js";
export { log2, exp2 } from "./log2-exp2.js";
export { srgbDecode, srgbEncode } from "./srgb-transfer.js";
export { sin, cos } from "./trig.js";

import { cbrt } from "./cbrt.js";
import { log2, exp2 } from "./log2-exp2.js";
import { srgbDecode, srgbEncode } from "./srgb-transfer.js";
import { sin, cos } from "./trig.js";

export type KernelName =
  | "cbrt"
  | "log2"
  | "exp2"
  | "srgb-decode"
  | "srgb-encode"
  | "sin"
  | "cos";

const KERNELS: Record<KernelName, (x: number) => number> = {
  cbrt,
  log2,
  exp2,
  "srgb-decode": srgbDecode,
  "srgb-encode": srgbEncode,
  sin,
  cos,
};

export function applyKernel(name: KernelName, x: number): number {
  const fn = KERNELS[name];
  if (!fn) throw new Error(`unknown kernel: ${name}`);
  return fn(x);
}
