/** Token type set and inheritance (chapter 03). */

export const TOKEN_TYPES = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "number",
  "opacity",
  "duration",
  "cubicBezier",
  "strokeStyle",
  "border",
  "shadow",
  "typography",
  "density",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export function isTokenType(value: string): value is TokenType {
  return (TOKEN_TYPES as readonly string[]).includes(value);
}

/**
 * Walk ancestor groups for the nearest `$type`. `nodes` maps path → node object.
 * Inheritance: a token without `$type` takes the nearest ancestor group's `$type`.
 */
export function inheritType(
  path: string,
  nodes: Map<string, Record<string, unknown>>,
): string | undefined {
  const self = nodes.get(path);
  if (self && typeof self.$type === "string") return self.$type;
  const parts = path.split(".");
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const ancestor = parts.slice(0, i).join(".");
    const node = nodes.get(ancestor);
    if (node && typeof node.$type === "string") return node.$type;
  }
  return undefined;
}

/** Compatible if equal, or both are known token types with the same name. */
export function typesCompatible(
  expected: string | undefined,
  actual: string | undefined,
): boolean {
  if (!expected || !actual) return true; // defer if unknown
  return expected === actual;
}
