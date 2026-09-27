/**
 * JSON Canonicalization Scheme (RFC 8785): members sorted by UTF-16 code units, ECMAScript number
 * and string serialization, no insignificant whitespace.
 */
import type { Json } from "../parse/ijson.js";

function codeUnitOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Replaces an object before it is written; `descend: false` writes everything below it as is. */
export type ObjectMapper = (o: Record<string, unknown>) => { readonly object: Record<string, unknown>; readonly descend: boolean };

/**
 * Appends the JCS form of `value` to `out`. `mapObject`, when given, is applied to each object
 * (canonical integrity uses it), except below `$extensions`, which is never rewritten.
 */
export function writeJcs(value: unknown, out: string[], mapObject?: ObjectMapper): void {
  if (value === null) {
    out.push("null");
    return;
  }
  switch (typeof value) {
    case "boolean":
      out.push(value ? "true" : "false");
      return;
    case "number":
      if (!Number.isFinite(value)) throw new Error("JCS: non-finite number");
      out.push(JSON.stringify(value));
      return;
    case "string":
      out.push(JSON.stringify(value));
      return;
    case "object": {
      if (Array.isArray(value)) {
        out.push("[");
        for (let i = 0; i < value.length; i += 1) {
          if (i > 0) out.push(",");
          writeJcs(value[i], out, mapObject);
        }
        out.push("]");
        return;
      }
      let obj = value as Record<string, unknown>;
      let childMapper = mapObject;
      if (mapObject) {
        const mapped = mapObject(obj);
        obj = mapped.object;
        if (!mapped.descend) childMapper = undefined;
      }
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort(codeUnitOrder);
      out.push("{");
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i]!;
        if (i > 0) out.push(",");
        out.push(JSON.stringify(k), ":");
        writeJcs(obj[k], out, k === "$extensions" ? undefined : childMapper);
      }
      out.push("}");
      return;
    }
    default:
      throw new Error(`JCS: unsupported ${typeof value}`);
  }
}

export function jcs(value: unknown): string {
  const out: string[] = [];
  writeJcs(value, out);
  return out.join("");
}

export type { Json };
