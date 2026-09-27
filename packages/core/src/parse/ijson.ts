/**
 * Bounded I-JSON parser (chapter 01, chapter 12; research CR3, R14).
 * - The byte length is checked before any decoding or tokenizing.
 * - Nesting depth is enforced during tokenizing (the top-level value is depth 0).
 * - Duplicate member names, lone surrogates, and non-binary64 numbers are rejected.
 * - Objects are created with a null prototype, so no member name has special meaning.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type ParseFailure = "bytes" | "depth" | "syntax" | "duplicate";

export class JsonParseError extends Error {
  readonly failure: ParseFailure;
  readonly pointer: string;

  constructor(failure: ParseFailure, message: string, pointer = "") {
    super(message);
    this.name = "JsonParseError";
    this.failure = failure;
    this.pointer = pointer;
  }
}

export interface ParseLimits {
  readonly maxBytes: number;
  readonly maxDepth: number;
  /** Freeze every object and array as it is built (callers that keep the value immutable). */
  readonly freeze?: boolean;
}

/** A member location, turned into a JSON Pointer only when an error needs it. */
interface Loc {
  readonly up: Loc | null;
  readonly segment: string;
}

function pointerOf(loc: Loc | null): string {
  const segments: string[] = [];
  for (let l = loc; l; l = l.up) segments.push(l.segment.replace(/~/g, "~0").replace(/\//g, "~1"));
  return segments.length === 0 ? "" : `/${segments.reverse().join("/")}`;
}

/** UTF-8 byte length of a JS string (lone surrogates count as 3, like replacement). */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        n += 4;
        i += 1;
      } else n += 3;
    } else n += 3;
  }
  return n;
}

/** Strict UTF-8 decode (no BOM stripping, no replacement). */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  const bad = (): never => {
    throw new JsonParseError("syntax", "invalid UTF-8");
  };
  while (i < bytes.length) {
    const b0 = bytes[i]!;
    let cp: number;
    if (b0 < 0x80) {
      cp = b0;
      i += 1;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      const b1 = bytes[i + 1] ?? bad();
      if ((b1 & 0xc0) !== 0x80) bad();
      cp = ((b0 & 0x1f) << 6) | (b1 & 0x3f);
      i += 2;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      const b1 = bytes[i + 1] ?? bad();
      const b2 = bytes[i + 2] ?? bad();
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) bad();
      cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
      if (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff)) bad();
      i += 3;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      const b1 = bytes[i + 1] ?? bad();
      const b2 = bytes[i + 2] ?? bad();
      const b3 = bytes[i + 3] ?? bad();
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) bad();
      cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      if (cp < 0x10000 || cp > 0x10ffff) bad();
      i += 4;
    } else {
      return bad();
    }
    out += String.fromCodePoint(cp);
  }
  return out;
}

const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

export function parseIJson(input: string | Uint8Array, limits: ParseLimits): Json {
  // Every UTF-16 code unit is at least one UTF-8 byte, so a longer string needs no count.
  const byteLength =
    typeof input === "string" ? (input.length > limits.maxBytes ? input.length : utf8Length(input)) : input.length;
  if (byteLength > limits.maxBytes) {
    throw new JsonParseError("bytes", `document exceeds ${limits.maxBytes} bytes`);
  }
  const text = typeof input === "string" ? input : decodeUtf8(input);
  if (text.charCodeAt(0) === 0xfeff) throw new JsonParseError("syntax", "UTF-8 BOM is not allowed");

  let i = 0;
  const n = text.length;
  const fail = (message: string): never => {
    throw new JsonParseError("syntax", message);
  };
  const skipWs = (): void => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i += 1;
      else break;
    }
  };

  const parseString = (): string => {
    if (text.charCodeAt(i) !== 0x22) fail("expected string");
    i += 1;
    let out = "";
    let start = i;
    // Whether any surrogate code unit occurs (raw or escaped); only then is pairing checked.
    let surrogate = false;
    for (;;) {
      if (i >= n) fail("unterminated string");
      const c = text.charCodeAt(i);
      if (c === 0x22) {
        out += text.slice(start, i);
        i += 1;
        break;
      }
      if (c < 0x20) fail("control character in string");
      if (c >= 0xd800 && c <= 0xdfff) surrogate = true;
      if (c === 0x5c) {
        out += text.slice(start, i);
        const e = text[i + 1];
        i += 2;
        switch (e) {
          case '"':
            out += '"';
            break;
          case "\\":
            out += "\\";
            break;
          case "/":
            out += "/";
            break;
          case "b":
            out += "\b";
            break;
          case "f":
            out += "\f";
            break;
          case "n":
            out += "\n";
            break;
          case "r":
            out += "\r";
            break;
          case "t":
            out += "\t";
            break;
          case "u": {
            const hex = text.slice(i, i + 4);
            if (!/^[0-9A-Fa-f]{4}$/.test(hex)) fail("invalid unicode escape");
            const unit = Number.parseInt(hex, 16);
            if (unit >= 0xd800 && unit <= 0xdfff) surrogate = true;
            out += String.fromCharCode(unit);
            i += 4;
            break;
          }
          default:
            fail("invalid escape");
        }
        start = i;
        continue;
      }
      i += 1;
    }
    // I-JSON: no lone surrogates.
    for (let k = 0; surrogate && k < out.length; k += 1) {
      const c = out.charCodeAt(k);
      if (c >= 0xd800 && c <= 0xdbff) {
        const d = out.charCodeAt(k + 1);
        if (!(d >= 0xdc00 && d <= 0xdfff)) fail("lone surrogate");
        k += 1;
      } else if (c >= 0xdc00 && c <= 0xdfff) fail("lone surrogate");
    }
    return out;
  };

  const freeze = limits.freeze === true;
  // A value's location is its parent's plus `segment`; a Loc object is built only for containers.
  const parseValue = (depth: number, up: Loc | null, segment: string | null): Json => {
    if (depth > limits.maxDepth) throw new JsonParseError("depth", `nesting exceeds ${limits.maxDepth}`, pointerOf(segment === null ? up : { up, segment }));
    skipWs();
    const c = text[i];
    if (c === "{") {
      i += 1;
      const at: Loc | null = segment === null ? up : { up, segment };
      const obj = Object.create(null) as { [key: string]: Json };
      skipWs();
      if (text[i] === "}") {
        i += 1;
        return freeze ? Object.freeze(obj) : obj;
      }
      for (;;) {
        skipWs();
        const key = parseString();
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          throw new JsonParseError("duplicate", "duplicate member", pointerOf({ up: at, segment: key }));
        }
        skipWs();
        if (text[i] !== ":") fail("expected ':'");
        i += 1;
        obj[key] = parseValue(depth + 1, at, key);
        skipWs();
        const sep = text[i];
        i += 1;
        if (sep === "}") return freeze ? Object.freeze(obj) : obj;
        if (sep !== ",") fail("expected ',' or '}'");
      }
    }
    if (c === "[") {
      i += 1;
      const at: Loc | null = segment === null ? up : { up, segment };
      const arr: Json[] = [];
      skipWs();
      if (text[i] === "]") {
        i += 1;
        return freeze ? (Object.freeze(arr) as Json[]) : arr;
      }
      for (;;) {
        arr.push(parseValue(depth + 1, at, String(arr.length)));
        skipWs();
        const sep = text[i];
        i += 1;
        if (sep === "]") return freeze ? (Object.freeze(arr) as Json[]) : arr;
        if (sep !== ",") fail("expected ',' or ']'");
      }
    }
    if (c === '"') return parseString();
    if (text.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return false;
    }
    if (text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(text);
    if (!m || m[0].length === 0) return fail("unexpected token");
    i += m[0].length;
    const value = Number(m[0]);
    if (!Number.isFinite(value)) fail("number outside binary64 range");
    return value;
  };

  const value = parseValue(0, null, null);
  skipWs();
  if (i !== n) fail("trailing content");
  return value;
}
