/**
 * Value serialization (contracts/css-output.md "Values"; research WR3; FR-W003, FR-W040).
 *
 * Every value is built only from typed numbers, fixed keywords, and grammar-checked, quoted family
 * names. A shape with no serializer is `null`; the caller omits and reports it (finding W2).
 */
import { GENERIC_FAMILIES, SYSTEM_COLORS } from "./generated/registry.js";

const FAMILY_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const STROKE_STYLES = new Set(["solid", "dashed", "dotted"]);
const LEAF_KEYS = ["srgb8", "system", "families", "number", "unit"];

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function hasExactly(v: Rec, keys: readonly string[]): boolean {
  const own = Object.keys(v);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(v, k));
}

/** ECMAScript's shortest round-trip form; CSS accepts it, exponents included. */
export function num(n: number): string {
  return String(n);
}

function color(v: Rec): string | null {
  if (hasExactly(v, ["system"])) {
    return typeof v.system === "string" && Object.hasOwn(SYSTEM_COLORS, v.system) ? SYSTEM_COLORS[v.system]! : null;
  }
  if (!hasExactly(v, ["srgb8", "alpha"])) return null;
  const c = v.srgb8;
  const a = v.alpha;
  if (!Array.isArray(c) || c.length !== 3 || !c.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) return null;
  if (!isFiniteNumber(a) || a < 0 || a > 1) return null;
  const rgb = `${c[0]} ${c[1]} ${c[2]}`;
  return a === 1 ? `rgb(${rgb})` : `rgb(${rgb} / ${num(a)})`;
}

function family(name: unknown): string | null {
  if (typeof name !== "string") return null;
  if (GENERIC_FAMILIES.has(name)) return name;
  if (!FAMILY_NAME.test(name)) return null;
  return `"${name.replace(/[\\"]/g, (m) => `\\${m}`)}"`;
}

function families(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const out: string[] = [];
  for (const name of list) {
    const f = family(name);
    if (f === null) return null;
    out.push(f);
  }
  return out.join(", ");
}

/** One resolved leaf value as CSS text, or null. */
export function serializeLeaf(v: unknown): string | null {
  if (isFiniteNumber(v)) return num(v);
  if (typeof v === "string") return STROKE_STYLES.has(v) ? v : null;
  if (Array.isArray(v)) {
    return v.length === 4 && v.every(isFiniteNumber) ? `cubic-bezier(${v.map(num).join(", ")})` : null;
  }
  if (!isRecord(v)) return null;
  if ("srgb8" in v || "system" in v) return color(v);
  if ("families" in v) return hasExactly(v, ["families"]) ? families(v.families) : null;
  if ("number" in v) return hasExactly(v, ["number"]) && isFiniteNumber(v.number) ? num(v.number) : null;
  if ("unit" in v) {
    if (!hasExactly(v, ["value", "unit"]) || !isFiniteNumber(v.value)) return null;
    return v.unit === "px" || v.unit === "ms" ? `${num(v.value)}${v.unit}` : null;
  }
  return null;
}

const COMPOSITES: readonly ReadonlySet<string>[] = [
  new Set(["width", "style", "color", "physical"]),
  new Set(["offsetX", "offsetY", "blur", "spread", "color", "physical"]),
  new Set(["fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing", "physical"]),
];

/** A border, shadow, or typography composite: every key is a member of one of them (chapter 03). */
export function isCompositeValue(v: unknown): v is Rec {
  if (!isRecord(v) || LEAF_KEYS.some((k) => k in v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && COMPOSITES.some((members) => keys.every((k) => members.has(k)));
}

function all(v: Rec, keys: readonly string[]): string[] | null {
  const out: string[] = [];
  for (const k of keys) {
    const s = serializeLeaf(v[k]);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

/** The border or shadow shorthand when every member serializes; typography has none. */
export function serializeShorthand(v: Rec): string | null {
  if ("offsetX" in v) return all(v, ["offsetX", "offsetY", "blur", "spread", "color"])?.join(" ") ?? null;
  if ("width" in v && "style" in v) return all(v, ["width", "style", "color"])?.join(" ") ?? null;
  return null;
}
