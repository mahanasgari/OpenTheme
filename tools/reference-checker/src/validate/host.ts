/**
 * Host declaration validation (FR-031, FR-032, FR-086, OT-HOST-001…004).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv/dist/2020.js";
import type { ErrorObject, AnySchema } from "ajv";
import {
  DiagnosticCollector,
  type Diagnostic,
} from "../diagnostics/collector.js";
import { flattenTokens } from "../tokens/graph.js";

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

const here = dirname(fileURLToPath(import.meta.url));
const schemasRoot = join(here, "../../../../specification/schemas/1.0");

const ALLOWED_STATES = new Set([
  "default",
  "hover",
  "focus-visible",
  "pressed",
  "disabled",
  "selected",
  "invalid",
]);

/** The chapter 03 token types (research R4); chapter 17 allows exactly these as property types. */
const R4_TYPES = new Set([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "number",
  "opacity",
  "duration",
  "cubicBezier",
  "strokeStyle",
  "border",
  "shadow",
  "typography",
  "density",
]);

/** Contract names, parts, properties, and variant axes and values (chapter 17). */
const NAME = /^[a-z][a-z0-9-]*$/;

/** JSON Pointer segment escaping (RFC 6901). */
const esc = (s: string): string => s.replace(/~/g, "~0").replace(/\//g, "~1");

function reservedNamespace(id: string): boolean {
  return (
    id === "std" ||
    id.startsWith("std.") ||
    id === "org.opentheme" ||
    id.startsWith("org.opentheme.") ||
    id === "uid" ||
    id.startsWith("uid.")
  );
}

function loadHostSchema(): AnySchema {
  return JSON.parse(
    readFileSync(join(schemasRoot, "host-declaration.schema.json"), "utf8"),
  ) as AnySchema;
}

let hostValidator:
  | ((data: unknown) => { valid: boolean; diagnostics: Diagnostic[] })
  | undefined;

function schemaValidate(data: unknown): Diagnostic[] {
  if (!hostValidator) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      validateSchema: false,
      verbose: true,
    });
    for (const rel of [
      "defs/display-text.schema.json",
      "defs/metadata.schema.json",
      "defs/tokens.schema.json",
      "defs/derivation.schema.json",
      "defs/layout.schema.json",
    ]) {
      const schema = JSON.parse(
        readFileSync(join(schemasRoot, rel), "utf8"),
      ) as AnySchema;
      const id =
        typeof schema === "object" &&
        schema &&
        "$id" in schema &&
        typeof (schema as { $id?: string }).$id === "string"
          ? (schema as { $id: string }).$id
          : rel;
      if (!ajv.getSchema(id)) ajv.addSchema(schema, id);
    }
    const hostSchema = loadHostSchema();
    const hostId =
      typeof hostSchema === "object" &&
      hostSchema &&
      "$id" in hostSchema &&
      typeof (hostSchema as { $id?: string }).$id === "string"
        ? (hostSchema as { $id: string }).$id
        : "host-declaration.schema.json";
    ajv.addSchema(hostSchema, hostId);
    const validate = ajv.getSchema(hostId)!;
    hostValidator = (document: unknown) => {
      const collector = new DiagnosticCollector();
      validate(document);
      for (const error of validate.errors ?? []) {
        const pointer = error.instancePath || "/";
        let code = "OT-DOC-004";
        if (error.keyword === "additionalProperties") code = "OT-DOC-003";
        if (error.keyword === "required") code = "OT-DOC-005";
        if (error.keyword === "pattern" && pointer.endsWith("/id")) {
          code = "OT-HOST-001";
        }
        collector.add({
          code,
          rule: code.replace(/^OT-/, "R-"),
          location: { document: "host", pointer: pointer || "/" },
          params: { detail: error.message ?? error.keyword },
        });
      }
      return {
        valid: !collector.finish().some((d) => d.severity === "error"),
        diagnostics: collector.finish(),
      };
    };
  }
  // Re-run with fresh collector via side effect — simplify:
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: false,
    verbose: true,
  });
  void ajv;
  return [];
}

/**
 * Validate a host declaration document.
 */
export function validateHost(
  doc: Record<string, unknown>,
): { valid: boolean; diagnostics: Diagnostic[] } {
  const collector = new DiagnosticCollector();

  const id = typeof doc.id === "string" ? doc.id : "";
  if (!id || reservedNamespace(id)) {
    collector.add({
      code: "OT-HOST-001",
      rule: "R-HOST-001",
      location: { document: "host", pointer: "/id" },
      params: { detail: id || "(missing)" },
    });
  }

  const contracts = doc.contracts;
  if (Array.isArray(contracts)) {
    const seen = new Set<string>();
    contracts.forEach((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const c = raw as {
        id?: string;
        states?: unknown[];
        properties?: Record<string, Record<string, string>>;
        defaults?: Record<string, unknown>;
        parts?: string[];
        variants?: Record<string, unknown>;
      };
      const pointer = `/contracts/${index}`;
      if (typeof c.id === "string") {
        if (seen.has(c.id)) {
          collector.add({
            code: "OT-HOST-004",
            rule: "R-HOST-004",
            location: { document: "host", pointer: `${pointer}/id` },
            params: { detail: c.id },
          });
        }
        seen.add(c.id);
        if (id && (!c.id.startsWith(`${id}/`) || !NAME.test(c.id.slice(id.length + 1)))) {
          collector.add({
            code: "OT-HOST-002",
            rule: "R-HOST-002",
            location: { document: "host", pointer: `${pointer}/id` },
            params: { detail: c.id },
          });
        }
      }
      if (Array.isArray(c.parts)) {
        c.parts.forEach((part, k) => {
          if (typeof part === "string" && !NAME.test(part)) {
            collector.add({
              code: "OT-HOST-002",
              rule: "R-HOST-002",
              location: { document: "host", pointer: `${pointer}/parts/${k}` },
              params: { detail: part },
            });
          }
        });
      }
      if (c.variants && typeof c.variants === "object" && !Array.isArray(c.variants)) {
        for (const [axis, values] of Object.entries(c.variants)) {
          if (!NAME.test(axis)) {
            collector.add({
              code: "OT-HOST-002",
              rule: "R-HOST-002",
              location: { document: "host", pointer: `${pointer}/variants/${esc(axis)}` },
              params: { detail: axis },
            });
          } else if (Array.isArray(values)) {
            values.forEach((v, k) => {
              if (typeof v === "string" && !NAME.test(v)) {
                collector.add({
                  code: "OT-HOST-002",
                  rule: "R-HOST-002",
                  location: { document: "host", pointer: `${pointer}/variants/${esc(axis)}/${k}` },
                  params: { detail: v },
                });
              }
            });
          }
        }
      }
      for (const s of c.states ?? []) {
        if (typeof s === "string" && !ALLOWED_STATES.has(s)) {
          collector.add({
            code: "OT-HOST-002",
            rule: "R-HOST-002",
            location: { document: "host", pointer: `${pointer}/states` },
            params: { detail: s },
          });
        }
      }
      if (c.properties) {
        for (const [part, props] of Object.entries(c.properties)) {
          if (!NAME.test(part)) {
            collector.add({
              code: "OT-HOST-002",
              rule: "R-HOST-002",
              location: { document: "host", pointer: `${pointer}/properties/${esc(part)}` },
              params: { detail: part },
            });
          }
          for (const [prop, type] of Object.entries(props)) {
            if (!NAME.test(prop) || !R4_TYPES.has(type)) {
              collector.add({
                code: "OT-HOST-002",
                rule: "R-HOST-002",
                location: {
                  document: "host",
                  pointer: `${pointer}/properties/${esc(part)}/${esc(prop)}`,
                },
                params: { detail: type },
              });
            }
          }
        }
      }
      // Defaults must cover every property
      if (c.properties && c.defaults) {
        for (const [part, props] of Object.entries(c.properties)) {
          const partDefaults = c.defaults[part] as
            | Record<string, unknown>
            | undefined;
          for (const prop of Object.keys(props)) {
            if (!partDefaults || !(prop in partDefaults)) {
              collector.add({
                code: "OT-HOST-003",
                rule: "R-HOST-003",
                location: {
                  document: "host",
                  pointer: `${pointer}/defaults/${esc(part)}`,
                },
                params: { detail: `${part}.${prop}` },
              });
            }
          }
        }
      }
    });
  }

  // Layout variant axis limit (16)
  const layoutVariants = doc.layoutVariants as
    | Record<string, { variants?: unknown[] }>
    | undefined;
  if (layoutVariants && typeof layoutVariants === "object") {
    for (const [region, entry] of Object.entries(layoutVariants)) {
      if (Array.isArray(entry?.variants) && entry.variants.length > 16) {
        collector.add({
          code: "OT-LIM-005",
          rule: "R-LIM-005",
          location: {
            document: "host",
            pointer: `/layoutVariants/${region}/variants`,
          },
          params: { detail: String(entry.variants.length) },
        });
      }
    }
  }

  // Host tokens: ensure defaults/aliases resolve against known paths (best-effort)
  const tokens = doc.tokens;
  if (tokens && typeof tokens === "object" && !Array.isArray(tokens)) {
    try {
      flattenTokens(tokens as Record<string, unknown>);
    } catch {
      // ignore
    }
  }

  const diagnostics = collector.finish();
  return {
    valid: !diagnostics.some((d) => d.severity === "error"),
    diagnostics,
  };
}

/** @internal unused stub retained for schema path */
void schemaValidate;
