/**
 * Resolved value encoding (chapter 10, "Resolved values").
 */
import { fromLiteral, quantize } from "../color/index.js";
import { aliasTarget, isRecord } from "./model.js";
import { colorLiteral, type Value } from "./values.js";

export type Encoded = unknown;

export function encodeValue(v: Value): Encoded {
  switch (v.k) {
    case "color": {
      const q = quantize(v.lab);
      return { srgb8: [...q.srgb8], alpha: q.alpha };
    }
    case "dimension":
      return { value: v.value, unit: v.unit };
    case "number":
      return { number: v.value };
    case "fontFamily":
      return { families: v.value };
    default:
      return v.value;
  }
}

function isEncodedLeaf(v: Record<string, unknown>): boolean {
  return "srgb8" in v || "system" in v || "families" in v || "number" in v || ("value" in v && "unit" in v);
}

export function isComposite(v: unknown): v is Record<string, unknown> {
  return isRecord(v) && !isEncodedLeaf(v);
}

/** Resolve composite members against the encoded token map (aliases, colors, font lists). */
export function resolveComposite(
  v: Record<string, unknown>,
  tokens: ReadonlyMap<string, Encoded>,
  seen: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, m] of Object.entries(v)) out[k] = resolveMember(m, tokens, seen);
  return out;
}

function resolveMember(m: unknown, tokens: ReadonlyMap<string, Encoded>, seen: ReadonlySet<string>): unknown {
  const target = aliasTarget(m);
  if (target !== null) {
    const r = tokens.get(target);
    if (r === undefined || seen.has(target)) return null;
    if (isComposite(r)) return resolveComposite(r, tokens, new Set([...seen, target]));
    if (isRecord(r) && "number" in r) return r.number;
    return r;
  }
  if (Array.isArray(m)) return m.every((x) => typeof x === "string") ? { families: m } : m;
  if (isRecord(m) && ("colorSpace" in m || "hex" in m)) {
    const lit = colorLiteral(m);
    if (lit) {
      const q = quantize(fromLiteral(lit));
      return { srgb8: [...q.srgb8], alpha: q.alpha };
    }
  }
  return m;
}

/** Second pass: resolve every composite in the encoded map (FR-057). */
export function resolveComposites(tokens: Map<string, Encoded>): void {
  for (const [path, v] of tokens) {
    if (isComposite(v)) tokens.set(path, resolveComposite(v, tokens, new Set([path])));
  }
}
