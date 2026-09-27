/**
 * Bounded I-JSON tokenizer (no JSON.parse). Research R14.
 * Size check runs before tokenizing; depth check during tokenizing.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export class ParseError extends Error {
  readonly code: string;
  readonly pointer: string;

  constructor(code: string, message: string, pointer = "") {
    super(message);
    this.name = "ParseError";
    this.code = code;
    this.pointer = pointer;
  }
}

const MAX_BYTES = 1_048_576;
const MAX_DEPTH = 16;

export interface ParseResult {
  value: JsonValue;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

export interface ParseOptions {
  /** Byte limit checked before tokenizing (default: theme limit 1 MiB). */
  maxBytes?: number;
  /** Deepest allowed value depth; the top-level value is depth 0 (default: 16). */
  maxDepth?: number;
}

export function parseIJson(input: string, options: ParseOptions = {}): ParseResult {
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const bytes = Buffer.byteLength(input, "utf8");
  if (bytes > maxBytes) {
    throw new ParseError("OT-LIM-001", `Document exceeds ${maxBytes} bytes`, "");
  }
  if (input.charCodeAt(0) === 0xfeff) {
    throw new ParseError("OT-DOC-001", "UTF-8 BOM is not allowed", "");
  }

  let i = 0;
  const n = input.length;

  const peek = (): string => input[i] ?? "";
  const next = (): string => {
    const ch = input[i] ?? "";
    i += 1;
    return ch;
  };

  const skipWs = (): void => {
    while (i < n) {
      const ch = input[i];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") i += 1;
      else break;
    }
  };

  const expect = (ch: string): void => {
    skipWs();
    if (next() !== ch) {
      throw new ParseError("OT-DOC-001", `Expected '${ch}'`, "");
    }
  };

  const parseString = (): string => {
    if (next() !== '"') {
      throw new ParseError("OT-DOC-001", "Expected string", "");
    }
    let out = "";
    while (i < n) {
      const ch = next();
      if (ch === '"') return out;
      if (ch === "\\") {
        const esc = next();
        switch (esc) {
          case '"':
          case "\\":
          case "/":
            out += esc;
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
            const hex = input.slice(i, i + 4);
            if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
              throw new ParseError("OT-DOC-001", "Invalid unicode escape", "");
            }
            i += 4;
            const code = Number.parseInt(hex, 16);
            if (isHighSurrogate(code)) {
              // Require a following \u low surrogate
              if (input.slice(i, i + 2) !== "\\u") {
                throw new ParseError("OT-DOC-001", "Lone surrogate", "");
              }
              i += 2;
              const hex2 = input.slice(i, i + 4);
              if (!/^[0-9A-Fa-f]{4}$/.test(hex2)) {
                throw new ParseError("OT-DOC-001", "Invalid unicode escape", "");
              }
              i += 4;
              const low = Number.parseInt(hex2, 16);
              if (!isLowSurrogate(low)) {
                throw new ParseError("OT-DOC-001", "Lone surrogate", "");
              }
              out += String.fromCodePoint(
                0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00),
              );
            } else if (isLowSurrogate(code)) {
              throw new ParseError("OT-DOC-001", "Lone surrogate", "");
            } else {
              out += String.fromCharCode(code);
            }
            break;
          }
          default:
            throw new ParseError("OT-DOC-001", "Invalid escape", "");
        }
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        throw new ParseError("OT-DOC-001", "Unescaped control character", "");
      }
      if (isHighSurrogate(code) || isLowSurrogate(code)) {
        throw new ParseError("OT-DOC-001", "Lone surrogate", "");
      }
      out += ch;
    }
    throw new ParseError("OT-DOC-001", "Unterminated string", "");
  };

  const parseNumber = (): number => {
    const start = i;
    if (peek() === "-") i += 1;
    if (peek() === "0") {
      i += 1;
      if (/[0-9]/.test(peek())) {
        throw new ParseError("OT-DOC-001", "Leading zeros are not allowed", "");
      }
    } else {
      if (!/[1-9]/.test(peek())) {
        throw new ParseError("OT-DOC-001", "Invalid number", "");
      }
      while (/[0-9]/.test(peek())) i += 1;
    }
    if (peek() === ".") {
      i += 1;
      if (!/[0-9]/.test(peek())) {
        throw new ParseError("OT-DOC-001", "Invalid number", "");
      }
      while (/[0-9]/.test(peek())) i += 1;
    }
    if (peek() === "e" || peek() === "E") {
      i += 1;
      if (peek() === "+" || peek() === "-") i += 1;
      if (!/[0-9]/.test(peek())) {
        throw new ParseError("OT-DOC-001", "Invalid number", "");
      }
      while (/[0-9]/.test(peek())) i += 1;
    }
    const text = input.slice(start, i);
    const value = Number(text);
    if (!Number.isFinite(value)) {
      throw new ParseError("OT-DOC-001", "Number outside binary64 range", "");
    }
    return value;
  };

  const parseValue = (depth: number): JsonValue => {
    if (depth > maxDepth) {
      throw new ParseError("OT-LIM-002", `Nesting exceeds ${maxDepth}`, "");
    }
    skipWs();
    const ch = peek();
    if (ch === '"') return parseString();
    if (ch === "{") return parseObject(depth);
    if (ch === "[") return parseArray(depth);
    if (ch === "t") {
      if (input.slice(i, i + 4) !== "true") {
        throw new ParseError("OT-DOC-001", "Invalid literal", "");
      }
      i += 4;
      return true;
    }
    if (ch === "f") {
      if (input.slice(i, i + 5) !== "false") {
        throw new ParseError("OT-DOC-001", "Invalid literal", "");
      }
      i += 5;
      return false;
    }
    if (ch === "n") {
      if (input.slice(i, i + 4) !== "null") {
        throw new ParseError("OT-DOC-001", "Invalid literal", "");
      }
      i += 4;
      return null;
    }
    if (ch === "-" || /[0-9]/.test(ch)) return parseNumber();
    throw new ParseError("OT-DOC-001", "Unexpected token", "");
  };

  const parseObject = (depth: number): { [key: string]: JsonValue } => {
    expect("{");
    const obj = Object.create(null) as { [key: string]: JsonValue };
    const seen = new Set<string>();
    skipWs();
    if (peek() === "}") {
      next();
      return obj;
    }
    for (;;) {
      skipWs();
      const key = parseString();
      if (seen.has(key)) {
        throw new ParseError("OT-DOC-002", `Duplicate member '${key}'`, `/${key}`);
      }
      seen.add(key);
      expect(":");
      obj[key] = parseValue(depth + 1);
      skipWs();
      const sep = next();
      if (sep === "}") break;
      if (sep !== ",") {
        throw new ParseError("OT-DOC-001", "Expected ',' or '}'", "");
      }
    }
    return obj;
  };

  const parseArray = (depth: number): JsonValue[] => {
    expect("[");
    const arr: JsonValue[] = [];
    skipWs();
    if (peek() === "]") {
      next();
      return arr;
    }
    for (;;) {
      arr.push(parseValue(depth + 1));
      skipWs();
      const sep = next();
      if (sep === "]") break;
      if (sep !== ",") {
        throw new ParseError("OT-DOC-001", "Expected ',' or ']'", "");
      }
    }
    return arr;
  };

  const value = parseValue(0);
  skipWs();
  if (i !== n) {
    throw new ParseError("OT-DOC-001", "Trailing content", "");
  }
  return { value };
}
