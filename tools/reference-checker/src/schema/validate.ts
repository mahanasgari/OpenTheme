import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv/dist/2020.js";
import type { ErrorObject, AnySchema } from "ajv";
import {
  DiagnosticCollector,
  type Diagnostic,
} from "../diagnostics/collector.js";

type AjvConstructor = new (options?: object) => {
  compile: (schema: AnySchema) => {
    (data: unknown): boolean;
    errors: ErrorObject[] | null | undefined;
  };
  addSchema: (schema: AnySchema, key?: string) => unknown;
  getSchema: (key: string) =>
    | (((data: unknown) => boolean) & {
        errors: ErrorObject[] | null | undefined;
      })
    | undefined;
};

const Ajv2020 = (
  AjvModule as unknown as { default?: AjvConstructor }
).default ?? (AjvModule as unknown as AjvConstructor);

const here = path.dirname(fileURLToPath(import.meta.url));
const schemasRoot = path.resolve(here, "../../../../specification/schemas/1.0");

function readSchema(rel: string): AnySchema {
  return JSON.parse(readFileSync(path.join(schemasRoot, rel), "utf8")) as AnySchema;
}

function pointerFromAjv(error: ErrorObject): string {
  const base = error.instancePath || "";
  if (error.keyword === "additionalProperties") {
    const prop = (error.params as { additionalProperty?: string })
      .additionalProperty;
    return prop ? `${base}/${prop}` : base || "/";
  }
  if (error.keyword === "required") {
    const missing = (error.params as { missingProperty?: string })
      .missingProperty;
    return missing ? `${base}/${missing}` : base || "/";
  }
  return base || "/";
}

function codeFromAjv(error: ErrorObject, schema: AnySchema): string {
  const schemaObj = schema as Record<string, unknown>;
  const parent = error.parentSchema as Record<string, unknown> | undefined;
  const parentCode = parent?.["x-opentheme-code"]
    ? String(parent["x-opentheme-code"])
    : undefined;

  if (error.keyword === "additionalProperties") {
    return parentCode ?? (schemaObj["x-opentheme-code"] as string | undefined) ?? "OT-DOC-003";
  }
  if (error.keyword === "required") {
    return "OT-DOC-005";
  }
  if (error.keyword === "type" || error.keyword === "enum") {
    return parentCode ?? "OT-DOC-004";
  }
  if (
    error.keyword === "maxItems" ||
    error.keyword === "minItems" ||
    error.keyword === "maxProperties" ||
    error.keyword === "minProperties" ||
    error.keyword === "maxLength" ||
    error.keyword === "minLength" ||
    error.keyword === "maximum" ||
    error.keyword === "minimum" ||
    error.keyword === "pattern" ||
    error.keyword === "const"
  ) {
    return parentCode ?? "OT-DOC-004";
  }
  if (error.keyword === "oneOf" || error.keyword === "anyOf") {
    if (parentCode) return parentCode;
    // Literal / value grammar failures surface as TOK-004.
    if ((error.instancePath ?? "").includes("/$value")) return "OT-TOK-004";
    // Chapter 13: an unannotated combinator failure is OT-DOC-004 (was OT-META-001, finding F24).
    return "OT-DOC-004";
  }
  if (parentCode) return parentCode;
  if (schemaObj["x-opentheme-code"]) {
    return String(schemaObj["x-opentheme-code"]);
  }
  return "OT-DOC-001";
}

/** Drop per-branch anyOf/oneOf noise; keep the parent combinator error. */
function isCombinatorBranchError(error: ErrorObject): boolean {
  return /\/(anyOf|oneOf)\/\d+/.test(error.schemaPath);
}

function ruleFromCode(code: string): string {
  return `R-${code.slice(3)}`;
}

let themeValidator:
  | ((data: unknown) => {
      valid: boolean;
      diagnostics: Diagnostic[];
    })
  | undefined;

export function validateThemeDocument(data: unknown): {
  valid: boolean;
  diagnostics: Diagnostic[];
} {
  if (!themeValidator) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      validateSchema: false,
      verbose: true,
    });

    for (const rel of [
      "defs/display-text.schema.json",
      "defs/metadata.schema.json",
      "defs/seeds.schema.json",
      "defs/tokens.schema.json",
      "defs/derivation.schema.json",
      "defs/contexts.schema.json",
      "defs/components.schema.json",
      "defs/customization.schema.json",
      "defs/layout.schema.json",
    ]) {
      const schema = readSchema(rel);
      const id =
        typeof schema === "object" &&
        schema &&
        "$id" in schema &&
        typeof schema.$id === "string"
          ? schema.$id
          : rel;
      if (!ajv.getSchema(id)) {
        ajv.addSchema(schema, id);
      }
    }

    const themeSchema = readSchema("theme.schema.json");
    const themeId =
      typeof themeSchema === "object" &&
      themeSchema &&
      "$id" in themeSchema &&
      typeof themeSchema.$id === "string"
        ? themeSchema.$id
        : "theme.schema.json";
    if (!ajv.getSchema(themeId)) {
      ajv.addSchema(themeSchema, themeId);
    }
    const validate = ajv.getSchema(themeId);
    if (!validate) {
      throw new Error("Failed to compile theme.schema.json");
    }

    themeValidator = (document: unknown) => {
      // Schema findings are merged into the document's collector, which applies the cap once.
      const collector = new DiagnosticCollector({ cap: Number.POSITIVE_INFINITY });
      const valid = validate(document) as boolean;
      const errors = (validate.errors ?? []).filter(
        (e) => !isCombinatorBranchError(e),
      );
      // Deduplicate (code, pointer) pairs from overlapping schema rules.
      const seen = new Set<string>();
      for (const error of errors) {
        const code = codeFromAjv(error, themeSchema);
        const pointer = pointerFromAjv(error);
        const key = `${code}|${pointer}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collector.add({
          code,
          location: { document: "theme", pointer },
          rule: ruleFromCode(code),
          params: { detail: error.message ?? error.keyword },
        });
      }
      const diagnostics = collector.finish();
      return {
        valid: valid && !diagnostics.some((d) => d.severity === "error"),
        diagnostics,
      };
    };
  }
  return themeValidator(data);
}
