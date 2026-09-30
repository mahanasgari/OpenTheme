/**
 * Value encodings between Core's resolved values and DTCG 2025.10 (research IR3, IR5). Every
 * function returns a value or the reason it cannot be represented; nothing is approximated.
 */
type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export type Result<T> = { readonly ok: true; readonly value: T; readonly note?: string } | { readonly ok: false; readonly reason: string };
const ok = <T>(value: T, note?: string): Result<T> => (note ? { ok: true, value, note } : { ok: true, value });
const no = (reason: string): Result<never> => ({ ok: false, reason });

// ---------------------------------------------------------------------------------------------
// Export: resolved → DTCG
// ---------------------------------------------------------------------------------------------

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function color(v: unknown): Result<unknown> {
  if (isRecord(v) && "system" in v) return no("a system color (forced colors) has no DTCG form");
  if (!isRecord(v) || !Array.isArray(v.srgb8) || !isNum(v.alpha)) return no("not a resolved color");
  const [r, g, b] = v.srgb8 as number[];
  return ok({
    colorSpace: "srgb",
    components: [r! / 255, g! / 255, b! / 255],
    ...(v.alpha === 1 ? {} : { alpha: v.alpha }),
    hex: `#${hex2(r!)}${hex2(g!)}${hex2(b!)}`,
  });
}

function dim(v: unknown, unit: "px" | "ms"): Result<unknown> {
  return isRecord(v) && isNum(v.value) && v.unit === unit ? ok({ value: v.value, unit }) : no(`not a resolved ${unit} value`);
}

const num = (v: unknown): Result<unknown> => (isNum(v) ? ok(v) : isRecord(v) && isNum(v.number) ? ok(v.number) : no("not a number"));
const families = (v: unknown): Result<unknown> =>
  isRecord(v) && Array.isArray(v.families) ? ok([...v.families]) : Array.isArray(v) ? ok([...v]) : no("not a font family list");

function members(v: unknown, spec: Readonly<Record<string, (x: unknown) => Result<unknown>>>, optional: readonly string[] = []): Result<unknown> {
  if (!isRecord(v)) return no("not a composite");
  const out: Rec = {};
  for (const [k, enc] of Object.entries(spec)) {
    if (!(k in v) || v[k] === null) {
      if (optional.includes(k)) continue;
      return no(`member ${k} is missing or unresolved`);
    }
    const r = enc(v[k]);
    if (!r.ok) return no(`member ${k}: ${r.reason}`);
    out[k] = r.value;
  }
  return ok(out);
}

/** The DTCG `$type` and `$value` for a resolved value of an OpenTheme type. */
export function encode(type: string, v: unknown): Result<{ type: string; value: unknown }> {
  const wrap = (t: string, r: Result<unknown>): Result<{ type: string; value: unknown }> => (r.ok ? ok({ type: t, value: r.value }) : r);
  switch (type) {
    case "color":
      return wrap("color", color(v));
    case "dimension":
      return wrap("dimension", dim(v, "px"));
    case "duration":
      return wrap("duration", dim(v, "ms"));
    case "number":
    case "opacity":
      return wrap("number", num(v));
    case "fontWeight":
      return wrap("fontWeight", num(v));
    case "fontFamily":
      return wrap("fontFamily", families(v));
    case "cubicBezier":
      return Array.isArray(v) && v.length === 4 && v.every(isNum) ? ok({ type: "cubicBezier", value: [...v] }) : no("not a cubic Bézier");
    case "strokeStyle":
      return typeof v === "string" ? ok({ type: "strokeStyle", value: v }) : no("not a stroke style");
    case "border":
      return wrap("border", members(v, { color, width: (x) => dim(x, "px"), style: (x) => (typeof x === "string" ? ok(x) : no("not a stroke style")) }));
    case "shadow":
      return wrap(
        "shadow",
        members(v, { color, offsetX: (x) => dim(x, "px"), offsetY: (x) => dim(x, "px"), blur: (x) => dim(x, "px"), spread: (x) => dim(x, "px") }),
      );
    case "typography": {
      if (isRecord(v) && isRecord(v.lineHeight)) return no("a line height given as a dimension has no DTCG form (DTCG's is a number)");
      return wrap(
        "typography",
        members(
          v,
          { fontFamily: families, fontSize: (x) => dim(x, "px"), fontWeight: num, letterSpacing: (x) => dim(x, "px"), lineHeight: num },
          ["letterSpacing", "fontWeight", "lineHeight"],
        ),
      );
    }
    case "density":
      return no("density has no DTCG type");
    default:
      return no(`type ${type} has no DTCG form`);
  }
}

// ---------------------------------------------------------------------------------------------
// Import: DTCG → OpenTheme literal
// ---------------------------------------------------------------------------------------------

/** Rewrites an alias `{a.b}` to its OpenTheme path, or null when its target was left out. */
export type AliasMap = (alias: string) => string | null;

const ALIAS = /^\{([^{}]+)\}$/;
export const isAlias = (v: unknown): v is string => typeof v === "string" && ALIAS.test(v);

const WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100,
  hairline: 100,
  "extra-light": 200,
  "ultra-light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  "semi-bold": 600,
  "demi-bold": 600,
  bold: 700,
  "extra-bold": 800,
  "ultra-bold": 800,
  black: 900,
  heavy: 900,
  "extra-black": 950,
  "ultra-black": 950,
};

function decodeColor(v: unknown): Result<unknown> {
  if (typeof v === "string") return no("a string color is not DTCG 2025.10 (use a color object)");
  if (!isRecord(v)) return no("not a color object");
  if (v.colorSpace !== "srgb" && v.colorSpace !== "oklch") return no(`color space ${String(v.colorSpace)} has no OpenTheme equivalent`);
  const c = v.components;
  if (!Array.isArray(c) || c.length !== 3 || !c.every(isNum)) return no("color components must be three numbers (no \"none\")");
  if (v.alpha !== undefined && !isNum(v.alpha)) return no("alpha must be a number");
  return ok({
    colorSpace: v.colorSpace,
    components: [...c],
    ...(v.alpha !== undefined && v.alpha !== 1 ? { alpha: v.alpha } : {}),
    ...(typeof v.hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(v.hex) ? { hex: v.hex } : {}),
  });
}

function decodeDim(v: unknown): Result<unknown> {
  if (!isRecord(v) || !isNum(v.value)) return no("not a dimension object");
  if (v.unit === "px") return ok({ value: v.value, unit: "px" });
  return no(`unit ${String(v.unit)} has no OpenTheme equivalent (px only)`);
}

function decodeDuration(v: unknown): Result<unknown> {
  if (!isRecord(v) || !isNum(v.value)) return no("not a duration object");
  if (v.unit === "ms") return ok({ value: v.value, unit: "ms" });
  if (v.unit === "s") {
    const ms = v.value * 1000;
    if (Number.isInteger(ms) && ms / 1000 === v.value) return ok({ value: ms, unit: "ms" }, `${v.value}s converted to ${ms}ms`);
    return no(`${v.value}s is not an exact number of milliseconds`);
  }
  return no(`unit ${String(v.unit)} is not a duration unit`);
}

function decodeWeight(v: unknown): Result<unknown> {
  if (isNum(v)) return ok(v);
  if (typeof v === "string" && Object.hasOwn(WEIGHTS, v)) return ok(WEIGHTS[v]!, `font weight "${v}" converted to ${WEIGHTS[v]}`);
  return no("not a font weight");
}

const decodeStroke = (v: unknown): Result<unknown> =>
  typeof v === "string" && ["solid", "dashed", "dotted"].includes(v)
    ? ok(v)
    : no(typeof v === "string" ? `stroke style ${v} has no OpenTheme equivalent` : "object stroke styles have no OpenTheme equivalent");

const decodeFamilies = (v: unknown): Result<unknown> =>
  typeof v === "string" ? ok([v]) : Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? ok([...v]) : no("not a font family");

/** Decode a value or member, passing aliases through `alias`. */
function withAlias(dec: (v: unknown) => Result<unknown>, alias: AliasMap): (v: unknown) => Result<unknown> {
  return (v) => {
    if (!isAlias(v)) return dec(v);
    const target = alias(v);
    return target === null ? no(`alias ${v} refers to a token that was left out`) : ok(target);
  };
}

function decodeComposite(v: unknown, spec: Readonly<Record<string, (x: unknown) => Result<unknown>>>, extra: readonly string[] = []): Result<unknown> {
  if (!isRecord(v)) return no("not a composite object");
  for (const k of Object.keys(v)) if (!(k in spec) && !extra.includes(k)) return no(`member ${k} has no OpenTheme equivalent`);
  const out: Rec = {};
  const notes: string[] = [];
  for (const [k, dec] of Object.entries(spec)) {
    if (!(k in v)) continue;
    const r = dec(v[k]);
    if (!r.ok) return no(`member ${k}: ${r.reason}`);
    out[k] = r.value;
    if (r.note) notes.push(r.note);
  }
  return ok(out, notes.join("; ") || undefined);
}

/** The OpenTheme type and literal for a DTCG token (aliases are rewritten by `alias`). */
export function decode(type: string, v: unknown, alias: AliasMap): Result<{ type: string; value: unknown }> {
  if (isAlias(v)) {
    const target = alias(v);
    return target === null ? no(`alias ${v} refers to a token that was left out`) : ok({ type, value: target });
  }
  if (isRecord(v) && "$ref" in v) return no("$ref values are not supported");
  const wrap = (t: string, r: Result<unknown>): Result<{ type: string; value: unknown }> => (r.ok ? ok({ type: t, value: r.value }, r.note) : r);
  const a = <T>(d: (x: unknown) => Result<T>) => withAlias(d, alias);
  switch (type) {
    case "color":
      return wrap("color", decodeColor(v));
    case "dimension":
      return wrap("dimension", decodeDim(v));
    case "duration":
      return wrap("duration", decodeDuration(v));
    case "number":
      return isNum(v) ? ok({ type: "number", value: v }) : no("not a number");
    case "fontWeight":
      return wrap("fontWeight", decodeWeight(v));
    case "fontFamily":
      return wrap("fontFamily", decodeFamilies(v));
    case "cubicBezier":
      return Array.isArray(v) && v.length === 4 && v.every(isNum) ? ok({ type, value: [...v] }) : no("not a cubic Bézier");
    case "strokeStyle":
      return wrap("strokeStyle", decodeStroke(v));
    case "border":
      return wrap("border", decodeComposite(v, { color: a(decodeColor), width: a(decodeDim), style: a(decodeStroke) }));
    case "shadow":
      if (Array.isArray(v)) return no("a list of shadows has no OpenTheme equivalent");
      if (isRecord(v) && v.inset === true) return no("inset shadows have no OpenTheme equivalent");
      return wrap(
        "shadow",
        decodeComposite(v, { color: a(decodeColor), offsetX: a(decodeDim), offsetY: a(decodeDim), blur: a(decodeDim), spread: a(decodeDim) }, ["inset"]),
      );
    case "typography":
      return wrap(
        "typography",
        decodeComposite(v, {
          fontFamily: a(decodeFamilies),
          fontSize: a(decodeDim),
          fontWeight: a(decodeWeight),
          letterSpacing: a(decodeDim),
          lineHeight: a((x) => (isNum(x) ? ok(x) : no("not a number"))),
        }),
      );
    default:
      return no(`type ${type} has no OpenTheme equivalent`);
  }
}
