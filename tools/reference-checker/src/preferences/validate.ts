/**
 * User Preferences document validation (chapter 18). Non-normative reference implementation.
 * Two levels: document-level errors make the document unusable; value-level problems
 * (OT-PREF-008) drop only that entry from the compiled preferences.
 */
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { ParseError, parseIJson, type JsonValue } from "../parse/ijson.js";

export const PREFERENCES_MAX_BYTES = 65_536;
export const PREFERENCES_MAX_DEPTH = 8;
export const PREFERENCES_MAX_VALUES = 512;
export const PREFERENCES_MAX_STRING = 256;
/** Supported format: major 1, minors 0..SUPPORTED_MINOR. */
const SUPPORTED_MAJOR = 1;
const SUPPORTED_MINOR = 0;

export interface PreferencesValidation {
  usable: boolean;
  values: Record<string, JsonValue>;
  diagnostics: Diagnostic[];
}

const MEMBERS = new Set(["openthemePreferences", "selection", "previous", "values", "$extensions"]);
const THEME_ID =
  /^(?:uid\.[a-z2-7]{26}|(?!uid\.)[a-z][a-z0-9-]{0,62}(?:\.[a-z0-9][a-z0-9-]{0,62}){1,7})$/;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const POINT_ID = /^(?:std\.)?[a-z][a-z0-9-]*$/;
const FORMAT = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const EXT_KEY = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
// C0, DEL, C1, bidirectional embedding/override and isolate controls.
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/;

function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isObject(v: unknown): v is Record<string, JsonValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isColor(v: Record<string, JsonValue>): boolean {
  const keys = Object.keys(v);
  if (!keys.every((k) => k === "colorSpace" || k === "components" || k === "alpha" || k === "hex")) {
    return false;
  }
  if (v.colorSpace !== "srgb" && v.colorSpace !== "oklch") return false;
  const c = v.components;
  if (!Array.isArray(c) || c.length !== 3 || !c.every((x) => typeof x === "number")) return false;
  if (v.alpha !== undefined && (typeof v.alpha !== "number" || v.alpha < 0 || v.alpha > 1)) {
    return false;
  }
  if (v.hex !== undefined && (typeof v.hex !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(v.hex))) {
    return false;
  }
  return true;
}

export function isPermittedLiteral(v: JsonValue): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (typeof v === "string") {
    return [...v].length <= PREFERENCES_MAX_STRING && !FORBIDDEN_CHARS.test(v);
  }
  return isObject(v) && isColor(v);
}

function validThemeRef(v: JsonValue, versionRequired: boolean): boolean {
  if (!isObject(v)) return false;
  for (const k of Object.keys(v)) if (k !== "id" && k !== "version") return false;
  if (typeof v.id !== "string" || v.id.length > 128 || !THEME_ID.test(v.id)) return false;
  if (v.version === undefined) return !versionRequired;
  return typeof v.version === "string" && SEMVER.test(v.version);
}

export function validatePreferences(input: string | JsonValue): PreferencesValidation {
  const collector = new DiagnosticCollector();
  const at = (pointer: string) => ({ document: "preferences" as const, pointer });
  const fail = (code: string, pointer: string, detail?: string): void => {
    collector.add({
      code,
      rule: code.replace(/^OT-/, "R-"),
      location: at(pointer),
      ...(detail !== undefined ? { params: { detail } } : {}),
    });
  };
  const unusable = (): PreferencesValidation => ({
    usable: false,
    values: {},
    diagnostics: collector.finish(),
  });

  // A JSON value is equivalent to its compact serialization (chapter 18, Conformance).
  const text = typeof input === "string" ? input : JSON.stringify(input);
  let doc: JsonValue;
  try {
    doc = parseIJson(text, {
      maxBytes: PREFERENCES_MAX_BYTES,
      maxDepth: PREFERENCES_MAX_DEPTH,
    }).value;
  } catch (err) {
    if (err instanceof ParseError) {
      const code = err.code === "OT-LIM-001" || err.code === "OT-LIM-002" ? "OT-PREF-002" : "OT-PREF-001";
      fail(code, "");
      return unusable();
    }
    throw err;
  }
  if (!isObject(doc)) {
    fail("OT-PREF-001", "");
    return unusable();
  }

  let documentError = false;
  const docFail = (code: string, pointer: string, detail?: string): void => {
    documentError = true;
    fail(code, pointer, detail);
  };

  for (const key of Object.keys(doc)) {
    if (!MEMBERS.has(key)) docFail("OT-PREF-005", `/${escapePointer(key)}`);
  }

  // Format version
  const format = doc.openthemePreferences;
  if (format === undefined || typeof format !== "string" || !FORMAT.test(format)) {
    docFail("OT-PREF-003", "/openthemePreferences");
  } else {
    const [major, minor] = format.split(".").map(Number) as [number, number];
    if (major !== SUPPORTED_MAJOR || minor > SUPPORTED_MINOR) {
      docFail("OT-PREF-004", "/openthemePreferences", `${SUPPORTED_MAJOR}.0-${SUPPORTED_MAJOR}.${SUPPORTED_MINOR}`);
    }
  }

  for (const member of ["selection", "previous", "values"] as const) {
    if (!(member in doc)) docFail("OT-PREF-005", `/${member}`, member);
  }
  if ("selection" in doc && doc.selection !== null && !validThemeRef(doc.selection!, false)) {
    docFail("OT-PREF-006", "/selection");
  }
  if ("previous" in doc && doc.previous !== null && !validThemeRef(doc.previous!, true)) {
    docFail("OT-PREF-006", "/previous");
  }

  if ("$extensions" in doc) {
    const ext = doc.$extensions;
    if (!isObject(ext)) {
      docFail("OT-PREF-005", "/$extensions");
    } else {
      for (const k of Object.keys(ext)) {
        if (!EXT_KEY.test(k)) docFail("OT-PREF-005", `/$extensions/${escapePointer(k)}`);
      }
    }
  }

  const compiled: Record<string, JsonValue> = {};
  if ("values" in doc) {
    const values = doc.values;
    if (!isObject(values)) {
      docFail("OT-PREF-007", "/values");
    } else {
      const keys = Object.keys(values);
      if (keys.length > PREFERENCES_MAX_VALUES) docFail("OT-PREF-007", "/values");
      for (const key of keys) {
        const pointer = `/values/${escapePointer(key)}`;
        if (key.length > 64 || !POINT_ID.test(key)) {
          docFail("OT-PREF-007", pointer);
          continue;
        }
        const value = values[key]!;
        if (!isPermittedLiteral(value)) {
          fail("OT-PREF-008", pointer);
          continue;
        }
        compiled[key] = value;
      }
    }
  }

  if (documentError) return unusable();
  return { usable: true, values: compiled, diagnostics: collector.finish() };
}
