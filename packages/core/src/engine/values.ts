/**
 * Concrete values produced by evaluation, and literal decoding by token type.
 */
import { fromLiteral, type ColorLiteral, type Lab } from "../color/index.js";
import { isRecord } from "./model.js";
import type { TokenType } from "./registry.js";

export type Value =
  | { readonly k: "color"; readonly lab: Lab }
  | { readonly k: "dimension"; readonly value: number; readonly unit: "px" | "ms" }
  | { readonly k: "number"; readonly value: number }
  | { readonly k: "fontFamily"; readonly value: unknown }
  | { readonly k: "raw"; readonly value: unknown };

const HEX = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/;

export function colorLiteral(v: unknown): ColorLiteral | null {
  if (!isRecord(v)) return null;
  const alpha = typeof v.alpha === "number" ? v.alpha : undefined;
  if (Array.isArray(v.components) && (v.colorSpace === "srgb" || v.colorSpace === "oklch")) {
    const c = v.components as number[];
    return { colorSpace: v.colorSpace, components: [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0], ...(alpha !== undefined ? { alpha } : {}) };
  }
  if (typeof v.hex === "string") {
    const m = HEX.exec(v.hex);
    if (!m) return null;
    const comp = [m[1], m[2], m[3]].map((x) => Number.parseInt(x!, 16) / 255) as [number, number, number];
    return { colorSpace: "srgb", components: comp, ...(alpha !== undefined ? { alpha } : {}) };
  }
  return null;
}

/** Decode a literal of a known type into a concrete value (the literal is already validated). */
export function decodeLiteral(type: TokenType | string, v: unknown): Value | null {
  switch (type) {
    case "color": {
      const lit = colorLiteral(v);
      return lit ? { k: "color", lab: fromLiteral(lit) } : null;
    }
    case "dimension":
      return isRecord(v) && typeof v.value === "number" ? { k: "dimension", value: v.value, unit: "px" } : null;
    case "duration":
      return isRecord(v) && typeof v.value === "number" ? { k: "dimension", value: v.value, unit: "ms" } : null;
    case "number":
    case "opacity":
    case "fontWeight":
      return typeof v === "number" ? { k: "number", value: v } : null;
    case "fontFamily":
      return { k: "fontFamily", value: v };
    default:
      return { k: "raw", value: v };
  }
}

/** The type a value can satisfy (for alias type compatibility). */
export function compatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  const numeric = new Set(["number", "opacity", "fontWeight"]);
  return numeric.has(expected) && numeric.has(actual);
}
