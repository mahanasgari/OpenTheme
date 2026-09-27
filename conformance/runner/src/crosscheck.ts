/**
 * Implementation cross-check (Core feature SC-C002): send every fixture request to two
 * implementations and compare the JCS bytes of their results. Diagnostic `params` are excluded
 * (the registry names them; their content is not normative).
 */
import { jcsLike } from "./compare.js";
import type { ProtocolClient } from "./protocol.js";

export function normalizeResult(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizeResult);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const isDiagnostic = typeof o.code === "string" && typeof o.severity === "string" && "location" in o;
    for (const [k, x] of Object.entries(o)) {
      if (isDiagnostic && (k === "params" || k === "related")) continue;
      out[k] = normalizeResult(x);
    }
    return out;
  }
  return v;
}

/** First differing JSON path between two values, or null when equal. */
export function firstDifference(a: unknown, b: unknown, path = ""): string | null {
  if (jcsLike(a) === jcsLike(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of [...keys].sort()) {
      const d = firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}/${k}`);
      if (d) return d;
    }
  }
  return `${path || "/"}: ${jcsLike(a)?.slice(0, 120)} ≠ ${jcsLike(b)?.slice(0, 120)}`;
}

export async function crosscheckRequest(
  a: ProtocolClient,
  b: ProtocolClient,
  id: string,
  kind: string,
  input: unknown,
): Promise<string | null> {
  const [ra, rb] = await Promise.all([a.request(id, kind, input), b.request(`${id}#b`, kind, input)]);
  if (ra.unsupported || rb.unsupported) return `unsupported by ${ra.unsupported ? a.implementation : b.implementation}`;
  return firstDifference(normalizeResult(ra.result), normalizeResult(rb.result));
}
