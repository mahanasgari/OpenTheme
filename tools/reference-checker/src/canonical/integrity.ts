/**
 * Integrity hash: sha256-<base64> over canonical UTF-8 bytes (SRI convention).
 */
import { createHash } from "node:crypto";
import { canonicalizeToBytes } from "./jcs.js";
import { normalizeTheme } from "./normalize.js";

export function integrityOfCanonicalBytes(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest("base64");
  return `sha256-${digest}`;
}

/**
 * Compute integrity for a theme: normalize → JCS → SHA-256.
 */
export function computeIntegrity(doc: Record<string, unknown>): {
  canonical: string;
  integrity: string;
  bytes: Uint8Array;
} {
  const normalized = normalizeTheme(doc);
  const bytes = canonicalizeToBytes(normalized);
  const canonical = new TextDecoder().decode(bytes);
  return {
    canonical,
    integrity: integrityOfCanonicalBytes(bytes),
    bytes,
  };
}

export function attachIntegrity(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const { integrity } = computeIntegrity(doc);
  return { ...doc, integrity };
}
