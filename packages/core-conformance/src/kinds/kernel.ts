import { fromHex64, KERNELS, toHex64 } from "@opentheme/core/internal-conformance";

/** `kernel`: evaluate the named normative kernel on each input vector (chapter 05). */
export function kernel(input: unknown): Record<string, unknown> {
  const payload = input as { function?: string; vectors?: Array<[string, string]> };
  const name = payload.function as keyof typeof KERNELS;
  const fn = KERNELS[name];
  if (!fn) throw new Error(`unknown kernel ${String(payload.function)}`);
  const vectors = (payload.vectors ?? []).map(([f, inHex]) => [f, inHex, toHex64(fn(fromHex64(inHex)))]);
  return { vectors };
}
