import { resolve as run } from "@opentheme/core/internal-conformance";

/** `resolve`: the normative resolution of a resolution input (chapter 10). */
export function resolve(input: unknown): Record<string, unknown> {
  const { resolved, diagnostics } = run(input as Parameters<typeof run>[0]);
  return { resolved, diagnostics };
}
