import { computeIntegrity } from "@opentheme/core/internal-conformance";

/** `canonicalize`: canonical bytes and integrity of a theme document (chapter 01). */
export function canonicalize(input: unknown): Record<string, unknown> {
  const payload = input as { theme?: unknown };
  const theme = (payload.theme ?? input) as Record<string, unknown>;
  if (!theme || typeof theme !== "object") throw new Error("canonicalize input requires theme");
  return { ...computeIntegrity(theme) };
}
