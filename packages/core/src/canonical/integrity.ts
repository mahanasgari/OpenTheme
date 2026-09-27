/**
 * Canonical form and integrity (chapter 01; research R3).
 * Normalization (closed list): drop color `alpha` exactly 1; convert `hex` to sRGB components when a
 * color has no components; drop `hex` when both are present; drop the top-level `integrity`;
 * never rewrite `$extensions`. Then serialize with JCS and hash with SHA-256.
 */
import { type ObjectMapper, writeJcs } from "./jcs.js";
import { base64, sha256, utf8Encode } from "./sha256.js";

const COLOR_KEYS = new Set(["colorSpace", "components", "alpha", "hex"]);
const HEX = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/;

function isColorLike(o: Record<string, unknown>): boolean {
  const keys = Object.keys(o);
  if (keys.length === 0 || !keys.every((k) => COLOR_KEYS.has(k))) return false;
  return "components" in o || typeof o.hex === "string";
}

function normalizeColor(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...o };
  if (out.alpha === 1) delete out.alpha;
  if (typeof out.hex === "string") {
    if (out.components === undefined) {
      const m = HEX.exec(out.hex);
      if (m) {
        out.components = [m[1], m[2], m[3]].map((h) => Number.parseInt(h!, 16) / 255);
        if (out.colorSpace === undefined) out.colorSpace = "srgb";
        delete out.hex;
      }
    } else {
      delete out.hex;
    }
  }
  return out;
}

/**
 * Normalization, applied object by object while serializing: a color-like object is normalized
 * (and written as is); `$extensions` is never rewritten (writeJcs stops mapping below it).
 */
const normalizeObject: ObjectMapper = (o) =>
  isColorLike(o) ? { object: normalizeColor(o), descend: false } : { object: o, descend: true };

function codeUnitOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The canonical value of `v`: members in code-unit order and colors normalized (chapter 01), with
 * `$extensions` sorted but never normalized. Unchanged subtrees are returned as they are, so only
 * objects that need reordering or normalization are copied.
 */
function canonicalValue(v: unknown, normalize: boolean): unknown {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("JCS: non-finite number");
    return v;
  }
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) {
    let out: unknown[] | undefined;
    for (let i = 0; i < v.length; i += 1) {
      const x = canonicalValue(v[i], normalize);
      if (x !== v[i]) (out ??= v.slice())[i] = x;
    }
    return out ?? v;
  }
  let o = v as Record<string, unknown>;
  let childNormalize = normalize;
  // Cheap pre-check before the full color test: a color has components or a hex string.
  if (normalize && (o.components !== undefined || typeof o.hex === "string") && isColorLike(o)) {
    o = normalizeColor(o);
    childNormalize = false;
  }
  const keys = Object.keys(o);
  let sorted = true;
  for (let i = 1; i < keys.length; i += 1) {
    if (!(keys[i - 1]! < keys[i]!)) {
      sorted = false;
      break;
    }
  }
  if (!sorted) keys.sort(codeUnitOrder);
  let out: Record<string, unknown> | undefined = sorted && o === v ? undefined : {};
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]!;
    const x = o[k];
    const c = canonicalValue(x, childNormalize && k !== "$extensions");
    if (out === undefined && c !== x) {
      out = {};
      for (let j = 0; j < i; j += 1) out[keys[j]!] = o[keys[j]!];
    }
    if (out !== undefined) out[k] = c;
  }
  return out ?? o;
}

/**
 * The canonical form (chapter 01): the normalized document in JCS (RFC 8785). JCS serializes
 * numbers and strings exactly as ECMAScript's JSON.stringify, so once members are in code-unit
 * order the engine's serializer writes it. Equal byte for byte to the member-by-member writer
 * below (tested).
 */
export function canonicalForm(theme: Readonly<Record<string, unknown>>): string {
  const { integrity: _omitted, ...rest } = theme;
  return JSON.stringify(canonicalValue(rest, true));
}

/** The same canonical form, written member by member (reference for the fast path above). */
export function canonicalFormSlow(theme: Readonly<Record<string, unknown>>): string {
  const { integrity: _omitted, ...rest } = theme;
  const out: string[] = [];
  writeJcs(rest, out, normalizeObject);
  return out.join("");
}

export function integrityOf(canonical: string): string {
  return `sha256-${base64(sha256(utf8Encode(canonical)))}`;
}

export function computeIntegrity(theme: Readonly<Record<string, unknown>>): {
  canonical: string;
  integrity: string;
} {
  const canonical = canonicalForm(theme);
  return { canonical, integrity: integrityOf(canonical) };
}
