/**
 * User Preferences document 1.0 (chapter 18; FR-C067 to FR-C069). Always untrusted input:
 * size-limited before parsing, strictly parsed, validated in two levels.
 */
import { jcs } from "../canonical/jcs.js";
import { DiagnosticCollector, type Diagnostic, jsonPointer } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";
import { colorLiteral } from "../engine/values.js";
import { type Json, JsonParseError, parseIJson } from "../parse/ijson.js";

export const PREFERENCES_FORMAT = { major: 1, minor: 0 } as const;
const MAX_BYTES = 65_536;
const MAX_DEPTH = 8;
const MAX_VALUES = 512;
const MAX_STRING = 256;

const MEMBERS = new Set(["openthemePreferences", "selection", "previous", "values", "$extensions"]);
const THEME_ID = /^(?:uid\.[a-z2-7]{26}|(?!uid\.)[a-z][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62}){1,7})$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const POINT_ID = /^(?:std\.)?[a-z][a-z0-9-]*$/;
const FORMAT = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const EXT_KEY = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/;

export interface UserPreferencesDocument {
  readonly openthemePreferences: string;
  readonly selection: { readonly id: string; readonly version?: string } | null;
  readonly previous: { readonly id: string; readonly version: string } | null;
  readonly values: Readonly<Record<string, Json>>;
  readonly $extensions?: Readonly<Record<string, Json>>;
}

export interface ParsedPreferences {
  /** The document, when usable (no document-level error). */
  readonly document: UserPreferencesDocument | null;
  /** The compiled `preferences` map: values that are permitted literals. */
  readonly values: Readonly<Record<string, Json>>;
  readonly diagnostics: Diagnostic[];
}

/** A finite number, a boolean, a short string without controls, or a color value. */
export function isPermittedLiteral(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (typeof v === "string") return [...v].length <= MAX_STRING && !FORBIDDEN.test(v);
  if (!isRecord(v)) return false;
  if (!Object.keys(v).every((k) => ["colorSpace", "components", "alpha", "hex"].includes(k))) return false;
  if (v.colorSpace !== "srgb" && v.colorSpace !== "oklch") return false;
  if (!Array.isArray(v.components) || v.components.length !== 3 || !v.components.every((x) => typeof x === "number")) {
    return false;
  }
  if (v.alpha !== undefined && (typeof v.alpha !== "number" || v.alpha < 0 || v.alpha > 1)) return false;
  if (v.hex !== undefined && !(typeof v.hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(v.hex))) return false;
  return colorLiteral(v) !== null;
}

function themeRef(v: unknown, versionRequired: boolean): boolean {
  if (!isRecord(v)) return false;
  if (!Object.keys(v).every((k) => k === "id" || k === "version")) return false;
  if (typeof v.id !== "string" || v.id.length > 128 || !THEME_ID.test(v.id)) return false;
  if (v.version === undefined) return !versionRequired;
  return typeof v.version === "string" && SEMVER.test(v.version);
}

export function parsePreferences(input: string | Uint8Array | unknown): ParsedPreferences {
  const c = new DiagnosticCollector("preferences");
  const at = (pointer: string) => ({ document: "preferences", pointer });
  const unusable = (): ParsedPreferences => ({ document: null, values: {}, diagnostics: c.finish() });
  let doc: unknown = input;
  if (typeof input === "string" || input instanceof Uint8Array) {
    try {
      doc = parseIJson(input, { maxBytes: MAX_BYTES, maxDepth: MAX_DEPTH });
    } catch (e) {
      if (!(e instanceof JsonParseError)) throw e;
      c.add(e.failure === "bytes" || e.failure === "depth" ? "OT-PREF-002" : "OT-PREF-001", at(""));
      return unusable();
    }
  } else {
    // A JSON value is equivalent to its compact serialization (chapter 18).
    return parsePreferences(JSON.stringify(input));
  }
  if (!isRecord(doc)) {
    c.add("OT-PREF-001", at(""));
    return unusable();
  }
  let error = false;
  const fail = (code: string, pointer: string) => {
    error = true;
    c.add(code, at(pointer));
  };
  for (const k of Object.keys(doc)) if (!MEMBERS.has(k)) fail("OT-PREF-005", jsonPointer([k]));
  const format = doc.openthemePreferences;
  if (typeof format !== "string" || !FORMAT.test(format)) fail("OT-PREF-003", "/openthemePreferences");
  else {
    const [major, minor] = format.split(".").map(Number) as [number, number];
    if (major !== PREFERENCES_FORMAT.major || minor > PREFERENCES_FORMAT.minor) fail("OT-PREF-004", "/openthemePreferences");
  }
  for (const m of ["selection", "previous", "values"]) if (!(m in doc)) fail("OT-PREF-005", `/${m}`);
  if ("selection" in doc && doc.selection !== null && !themeRef(doc.selection, false)) fail("OT-PREF-006", "/selection");
  if ("previous" in doc && doc.previous !== null && !themeRef(doc.previous, true)) fail("OT-PREF-006", "/previous");
  if ("$extensions" in doc) {
    if (!isRecord(doc.$extensions)) fail("OT-PREF-005", "/$extensions");
    else for (const k of Object.keys(doc.$extensions)) if (!EXT_KEY.test(k)) fail("OT-PREF-005", jsonPointer(["$extensions", k]));
  }
  const compiled: Record<string, Json> = {};
  if ("values" in doc) {
    const values = doc.values;
    if (!isRecord(values)) fail("OT-PREF-007", "/values");
    else {
      const keys = Object.keys(values);
      if (keys.length > MAX_VALUES) fail("OT-PREF-007", "/values");
      for (const k of keys) {
        const ptr = jsonPointer(["values", k]);
        if (k.length > 64 || !POINT_ID.test(k)) {
          fail("OT-PREF-007", ptr);
          continue;
        }
        const v = values[k]!;
        if (!isPermittedLiteral(v)) {
          c.add("OT-PREF-008", at(ptr));
          continue;
        }
        compiled[k] = v as Json;
      }
    }
  }
  if (error) return unusable();
  return { document: doc as unknown as UserPreferencesDocument, values: compiled, diagnostics: c.finish() };
}

/** Canonical (JCS) bytes of a document (chapter 18, "Canonical form"). */
export function serializePreferences(doc: UserPreferencesDocument): string {
  return jcs(doc);
}

export function emptyPreferences(): UserPreferencesDocument {
  return { openthemePreferences: "1.0", selection: null, previous: null, values: {} };
}
