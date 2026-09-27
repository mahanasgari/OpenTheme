/**
 * Specification normalization before JCS (research R3).
 */
import type { Json } from "./jcs.js";

function hexToComponents(hex: string): number[] | null {
  const h = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function normalizeColor(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  if (out.alpha === 1) delete out.alpha;
  if (
    typeof out.hex === "string" &&
    (!Array.isArray(out.components) || out.components.length === 0)
  ) {
    const comps = hexToComponents(out.hex);
    if (comps) {
      out.colorSpace = out.colorSpace ?? "srgb";
      out.components = comps;
      delete out.hex;
    }
  } else if (typeof out.hex === "string" && Array.isArray(out.components)) {
    delete out.hex;
  }
  return out;
}

function walk(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(walk);
  const obj = value as Record<string, unknown>;
  // Preserve $extensions byte-for-byte (no walk into it for reordering of opaque data —
  // still recurse keys but treat as opaque objects sorted by JCS later)
  let next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "integrity") continue;
    if (k === "$extensions") {
      next[k] = v;
      continue;
    }
    next[k] = walk(v);
  }
  if (
    typeof next.colorSpace === "string" ||
    typeof next.hex === "string" ||
    Array.isArray(next.components)
  ) {
    next = normalizeColor(next);
  }
  return next;
}

/**
 * Normalize a theme document for canonicalization: strip integrity, drop alpha:1,
 * convert hex-only colors to components. Does not mutate the input.
 */
export function normalizeTheme(doc: Record<string, unknown>): Json {
  return walk(structuredClone(doc)) as Json;
}
