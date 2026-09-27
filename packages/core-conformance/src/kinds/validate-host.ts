import { validateHost as run } from "@opentheme/core/internal-conformance";

/** `validate-host`: host declaration validity and diagnostics (chapter 17). */
export function validateHost(input: unknown): Record<string, unknown> {
  const payload = input as { host?: unknown };
  const host = payload.host ?? input;
  const r = run(typeof host === "string" ? host : JSON.stringify(host));
  return { validity: r.valid ? "valid" : "invalid", diagnostics: r.diagnostics };
}
