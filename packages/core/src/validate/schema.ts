/**
 * JSON Schema failure mapping (chapter 13, "Validation procedure"). Uses the precompiled
 * validators; never compiles code at runtime.
 */
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import {
  validateHostSchema,
  validatePreferencesSchema,
  validateThemeSchema,
} from "../generated/validators.js";

interface AjvError {
  readonly keyword: string;
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly params: Record<string, unknown>;
  readonly parentSchema?: Record<string, unknown>;
}

type Validator = ((data: unknown) => boolean) & { errors?: AjvError[] | null };

function pointerOf(e: AjvError): string {
  const base = e.instancePath;
  if (e.keyword === "additionalProperties" && typeof e.params.additionalProperty === "string") {
    return `${base}/${e.params.additionalProperty}`;
  }
  if (e.keyword === "required" && typeof e.params.missingProperty === "string") {
    return `${base}/${e.params.missingProperty}`;
  }
  return base || "/";
}

function codeOf(e: AjvError): string {
  if (e.keyword === "required") return "OT-DOC-005";
  const annotated = e.parentSchema?.["x-opentheme-code"];
  if (typeof annotated === "string") return annotated;
  if (e.keyword === "additionalProperties") return "OT-DOC-003";
  if (e.keyword === "oneOf" || e.keyword === "anyOf") {
    return e.instancePath.includes("/$value") ? "OT-TOK-004" : "OT-DOC-004";
  }
  return "OT-DOC-004";
}

export interface SchemaFinding {
  readonly code: string;
  readonly pointer: string;
}

function run(validator: Validator, data: unknown): SchemaFinding[] {
  if (validator(data)) return [];
  const out: SchemaFinding[] = [];
  const seen = new Set<string>();
  for (const e of validator.errors ?? []) {
    if (/\/(anyOf|oneOf)\/\d+/.test(e.schemaPath)) continue;
    const f = { code: codeOf(e), pointer: pointerOf(e) };
    const key = `${f.code}|${f.pointer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function themeSchemaFindings(doc: unknown): SchemaFinding[] {
  // Schema failures under /tokens are never reported (token grammar is validation step 7,
  // chapter 13), and no other schema node reads the token tree, so the tree is not walked here.
  const input =
    doc !== null && typeof doc === "object" && !Array.isArray(doc) && isPlainTree((doc as Record<string, unknown>).tokens)
      ? { ...(doc as Record<string, unknown>), tokens: {} }
      : doc;
  return run(validateThemeSchema as unknown as Validator, input).filter(
    (f) => !f.pointer.startsWith("/tokens") && !(f.pointer === "/contexts" && f.code === "OT-DOC-004"),
  );
}

function isPlainTree(v: unknown): boolean {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function hostSchemaFindings(doc: unknown): SchemaFinding[] {
  return run(validateHostSchema as unknown as Validator, doc);
}

export function preferencesSchemaFindings(doc: unknown): SchemaFinding[] {
  return run(validatePreferencesSchema as unknown as Validator, doc);
}

export function reportSchema(collector: DiagnosticCollector, document: string, findings: readonly SchemaFinding[]): void {
  for (const f of findings) collector.add(f.code, { document, pointer: f.pointer });
}
