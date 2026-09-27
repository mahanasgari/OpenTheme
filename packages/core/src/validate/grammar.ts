/**
 * Token literal grammar (OT-TOK-004) and range (OT-TOK-005) per type
 * (data model §4; tokens.schema.json $defs). Shape is grammar; numeric bounds are range.
 */
import { isRecord } from "../engine/model.js";

export const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

const FAMILY_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
export const ALIAS_PATTERN = /^\{[a-z][a-z0-9./-]*\}$/;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isAliasString(v: unknown): v is string {
  return typeof v === "string" && v.length <= 258 && ALIAS_PATTERN.test(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function colorShape(v: unknown): boolean {
  if (!isRecord(v)) return false;
  for (const k of Object.keys(v)) if (!["colorSpace", "components", "alpha", "hex"].includes(k)) return false;
  if (v.hex !== undefined && !(typeof v.hex === "string" && HEX.test(v.hex))) return false;
  // colorSpace and components are required; hex is optional (data model §4, tokens.schema.json).
  if (v.components === undefined) return false;
  if (v.colorSpace !== "srgb" && v.colorSpace !== "oklch") return false;
  if (!Array.isArray(v.components) || v.components.length !== 3 || !v.components.every(isNum)) return false;
  return v.alpha === undefined || isNum(v.alpha);
}

function dimensionShape(v: unknown): boolean {
  return isRecord(v) && Object.keys(v).every((k) => k === "value" || k === "unit") && isNum(v.value) && v.unit === "px";
}

function durationShape(v: unknown): boolean {
  return isRecord(v) && Object.keys(v).every((k) => k === "value" || k === "unit") && isNum(v.value) && v.unit === "ms";
}

function familyList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 8 &&
    v.every((s) => typeof s === "string" && (GENERIC_FAMILIES.has(s) || FAMILY_NAME.test(s)))
  );
}

function fontFamilyShape(v: unknown): boolean {
  if (familyList(v)) return true;
  return isRecord(v) && familyList(v.default) && Object.values(v).every(familyList);
}

function memberShape(v: unknown, types: readonly string[]): boolean {
  if (isAliasString(v)) return true;
  return types.some((t) => shapeOf(t, v));
}

const COMPOSITE_MEMBERS: Record<string, Record<string, readonly string[]>> = {
  border: { width: ["dimension"], style: ["strokeStyle"], color: ["color"], physical: ["boolean"] },
  shadow: {
    offsetX: ["dimension"],
    offsetY: ["dimension"],
    blur: ["dimension"],
    spread: ["dimension"],
    color: ["color"],
    inset: ["boolean"],
    physical: ["boolean"],
  },
  typography: {
    fontFamily: ["fontFamily"],
    fontWeight: ["fontWeight"],
    fontSize: ["dimension"],
    lineHeight: ["number", "dimension"],
    letterSpacing: ["dimension"],
    physical: ["boolean"],
  },
};

function compositeShape(type: string, v: unknown): boolean {
  const members = COMPOSITE_MEMBERS[type]!;
  if (!isRecord(v)) return false;
  for (const [k, m] of Object.entries(v)) {
    const allowed = members[k];
    if (!allowed) return false;
    if (allowed.includes("boolean")) {
      if (typeof m !== "boolean") return false;
      continue;
    }
    if (!memberShape(m, allowed)) return false;
  }
  return true;
}

/** Grammar (shape) of a literal of `type`. Aliases are checked by the reference graph. */
export function shapeOf(type: string, v: unknown): boolean {
  switch (type) {
    case "color":
      return colorShape(v);
    case "dimension":
      return dimensionShape(v);
    case "duration":
      return durationShape(v);
    case "fontFamily":
      return fontFamilyShape(v);
    case "fontWeight":
      return isNum(v) && Number.isInteger(v);
    case "number":
    case "opacity":
      return isNum(v);
    case "cubicBezier":
      return Array.isArray(v) && v.length === 4 && v.every(isNum);
    case "strokeStyle":
      return v === "solid" || v === "dashed" || v === "dotted";
    case "density":
      return v === "compact" || v === "standard" || v === "comfortable";
    case "border":
    case "shadow":
    case "typography":
      return compositeShape(type, v);
    default:
      return false;
  }
}

/** Numeric bounds of a literal whose shape is valid (type bounds, then the registry role range). */
export function inRange(
  type: string,
  v: unknown,
  _role?: { readonly min?: number; readonly max?: number } | null,
): boolean {
  const within = (n: number, lo?: number, hi?: number) => (lo === undefined || n >= lo) && (hi === undefined || n <= hi);
  switch (type) {
    case "color": {
      const c = v as Record<string, unknown>;
      if (c.alpha !== undefined && !within(c.alpha as number, 0, 1)) return false;
      if (c.colorSpace === "srgb") return (c.components as number[]).every((n) => within(n, 0, 1));
      return true;
    }
    case "opacity":
      return within(v as number, 0, 1);
    case "fontWeight":
      return within(v as number, 1, 1000);
    case "duration":
      return within((v as { value: number }).value, 0, 1000);
    case "cubicBezier": {
      const a = v as number[];
      return within(a[0]!, 0, 1) && within(a[2]!, 0, 1);
    }
    case "border":
    case "shadow":
    case "typography": {
      // Each literal member is bounded like a token of its type (aliases are checked elsewhere).
      const members = COMPOSITE_MEMBERS[type]!;
      for (const [k, m] of Object.entries(v as Record<string, unknown>)) {
        if (isAliasString(m) || typeof m === "boolean") continue;
        const t = members[k]!.find((mt) => shapeOf(mt, m));
        if (t && !inRange(t, m)) return false;
      }
      return true;
    }
    default:
      return true;
  }
}
