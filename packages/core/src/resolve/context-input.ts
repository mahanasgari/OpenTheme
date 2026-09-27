/**
 * Request validation (FR-C050 to FR-C053). Context values mirror the resolution-input schema
 * exactly; anything else is a caller error, reported without guessing a value.
 */
import { isRecord } from "../engine/model.js";
import { type OperationalError, operationalError } from "../errors/operational.js";

const PLATFORM: Readonly<Record<string, (v: unknown) => boolean>> = {
  colorScheme: (v) => v === "light" || v === "dark" || v === "no-preference",
  contrast: (v) => v === "standard" || v === "high",
  forcedColors: (v) => typeof v === "boolean",
  reducedMotion: (v) => typeof v === "boolean",
  textScale: (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
};

/** A well-formed BCP 47 tag shape (RFC 5646 `langtag` subtags); no registry lookup. */
const BCP47 = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

const ENVIRONMENT: Readonly<Record<string, (v: unknown) => boolean>> = {
  sizeClass: (v) => v === "compact" || v === "medium" || v === "expanded",
  locale: (v) => typeof v === "string" && v.length <= 64 && BCP47.test(v),
  direction: (v) => v === "ltr" || v === "rtl",
};

function checkMembers(
  value: unknown,
  members: Readonly<Record<string, (v: unknown) => boolean>>,
  at: string,
  operation: string,
  partial: boolean,
): OperationalError | null {
  if (!isRecord(value)) return operationalError("invalid-context", operation, `${at} must be an object.`, at);
  for (const k of Object.keys(value)) {
    if (!(k in members)) return operationalError("invalid-context", operation, `${at} has an unknown member.`, `${at}/${k}`);
  }
  for (const [k, ok] of Object.entries(members)) {
    if (!(k in value)) {
      if (partial) continue;
      return operationalError("invalid-context", operation, `${at}/${k} is required.`, `${at}/${k}`);
    }
    if (!ok(value[k])) return operationalError("invalid-context", operation, `${at}/${k} is outside the schema.`, `${at}/${k}`);
  }
  return null;
}

export function checkContext(
  platform: unknown,
  environment: unknown,
  operation: string,
  partial = false,
): OperationalError | null {
  return (
    checkMembers(platform, PLATFORM, "/platform", operation, partial) ??
    checkMembers(environment, ENVIRONMENT, "/environment", operation, partial)
  );
}

function themeRef(v: unknown, versionRequired: boolean): boolean {
  if (!isRecord(v) || typeof v.id !== "string") return false;
  if (!Object.keys(v).every((k) => k === "id" || k === "version")) return false;
  return v.version === undefined ? !versionRequired : typeof v.version === "string";
}

/** The request members other than context (invalid-argument). */
export function checkRequest(request: unknown, operation: string): OperationalError | null {
  const bad = (pointer: string, message: string) => operationalError("invalid-argument", operation, message, pointer);
  if (!isRecord(request)) return bad("", "The resolution request must be an object.");
  for (const k of Object.keys(request)) {
    if (!["selection", "previous", "platform", "environment", "preferences", "policy"].includes(k)) {
      return bad(`/${k}`, "The resolution request has an unknown member.");
    }
  }
  if (!themeRef(request.selection, false)) return bad("/selection", "selection must be { id, version? }.");
  if (request.previous !== null && request.previous !== undefined && !themeRef(request.previous, true)) {
    return bad("/previous", "previous must be null or { id, version }.");
  }
  if (request.preferences !== undefined && !isRecord(request.preferences)) return bad("/preferences", "preferences must be an object.");
  if (!isRecord(request.policy)) return bad("/policy", "policy must be an object.");
  return checkContext(request.platform, request.environment, operation);
}
