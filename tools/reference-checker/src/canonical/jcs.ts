/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) serializer.
 */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

function escapeString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError("JCS rejects non-finite numbers");
  }
  // ES6 Number.toString produces the unique shortest round-trip form used by JCS.
  return String(value);
}

export function canonicalize(value: Json): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return serializeNumber(value);
  if (typeof value === "string") return escapeString(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item as Json)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const body = keys
    .map((key) => `${escapeString(key)}:${canonicalize(value[key] as Json)}`)
    .join(",");
  return `{${body}}`;
}

export function canonicalizeToBytes(value: Json): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
