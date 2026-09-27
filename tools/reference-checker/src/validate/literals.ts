/**
 * Token literal grammar and range, taken from the normative definitions in
 * `tokens.schema.json` (data model §4; chapter 13 step 7; finding F26):
 * - grammar (OT-TOK-004): the type's definition with its numeric bounds removed;
 * - range (OT-TOK-005): the full definition, plus sRGB components in [0, 1] (chapter 11,
 *   "Literal ranges"), for the literal and for each literal composite member.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv/dist/2020.js";

type Validator = (data: unknown) => boolean;
type AjvLike = { addSchema(schema: object): unknown; getSchema(key: string): Validator | undefined };
const Ajv2020 = ((AjvModule as unknown as { default?: unknown }).default ?? AjvModule) as new (o: object) => AjvLike;

const here = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = JSON.parse(
  readFileSync(path.resolve(here, "../../../../specification/schemas/1.0/defs/tokens.schema.json"), "utf8"),
) as { $id: string };

const BOUNDS = new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]);

function withoutBounds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutBounds);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (!BOUNDS.has(k)) out[k] = withoutBounds(x);
    return out;
  }
  return v;
}

let validators: { shape: AjvLike; full: AjvLike } | undefined;
function ajvs(): { shape: AjvLike; full: AjvLike } {
  if (!validators) {
    const full = new Ajv2020({ strict: false, validateSchema: false });
    full.addSchema(TOKENS);
    const shape = new Ajv2020({ strict: false, validateSchema: false });
    shape.addSchema(withoutBounds(TOKENS) as object);
    validators = { shape, full };
  }
  return validators;
}

const COMPOSITES = new Set(["border", "shadow", "typography"]);

function srgbInRange(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return true;
  const c = v as { colorSpace?: unknown; components?: unknown };
  if (c.colorSpace !== "srgb" || !Array.isArray(c.components)) return true;
  return c.components.every((n) => typeof n === "number" && n >= 0 && n <= 1);
}

function check(which: "shape" | "full", type: string, value: unknown): boolean {
  const validate = ajvs()[which].getSchema(`${TOKENS.$id}#/$defs/${type}`);
  return validate ? validate(value) : true;
}

/** Grammar of a literal of `type` (aliases are checked by the reference graph). */
export function literalShapeOk(type: string, value: unknown): boolean {
  return check("shape", type, value);
}

/** Bounds of a literal whose grammar is valid. */
export function literalRangeOk(type: string, value: unknown): boolean {
  if (!check("full", type, value)) return false;
  if (type === "color") return srgbInRange(value);
  if (COMPOSITES.has(type) && value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(srgbInRange);
  }
  return true;
}
