import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv/dist/2020.js";
import type { AnySchema, ErrorObject } from "ajv";

type AjvConstructor = new (options?: object) => {
  compile: (schema: AnySchema) => {
    (data: unknown): boolean;
    errors: ErrorObject[] | null | undefined;
  };
};

const Ajv2020 = (
  AjvModule as unknown as { default?: AjvConstructor }
).default ?? (AjvModule as unknown as AjvConstructor);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../");

export interface LoadedRegistries {
  version: string;
  limits: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
  contextDimensions: Record<string, unknown>;
  forcedColors: Record<string, unknown>;
  transformations: Record<string, unknown>;
  rules: Record<string, unknown>;
  semanticBaseline: Record<string, unknown>;
  componentCatalog: Record<string, unknown>;
  customizationPoints: Record<string, unknown>;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function loadRegistries(
  root = path.join(repoRoot, "specification"),
): LoadedRegistries {
  const registryDir = path.join(root, "registry/1.0");
  const schemaDir = path.join(root, "schemas/1.0/registry");
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  const names = [
    "limits",
    "diagnostics",
    "context-dimensions",
    "forced-colors",
    "transformations",
    "rules",
    "semantic-baseline",
    "component-catalog",
    "customization-points",
  ] as const;

  const loaded: Record<string, unknown> = {};
  for (const name of names) {
    const dataPath = path.join(registryDir, `${name}.json`);
    const schemaPath = path.join(schemaDir, `${name}.schema.json`);
    const data = readJson(dataPath) as Record<string, unknown>;
    const schema = readJson(schemaPath) as AnySchema;
    const validate = ajv.compile(schema);
    if (!validate(data)) {
      const details = ((validate.errors ?? []) as ErrorObject[])
        .map((e) => `${e.instancePath} ${e.message}`)
        .join("; ");
      throw new Error(`Registry ${name} failed schema validation: ${details}`);
    }
    loaded[name] = data;
  }

  for (const file of readdirSync(registryDir)) {
    if (!file.endsWith(".json")) continue;
    const base = file.replace(/\.json$/, "");
    if (!names.includes(base as (typeof names)[number])) {
      throw new Error(`Unexpected registry file: ${file}`);
    }
  }

  return {
    version: String((loaded.limits as { version: string }).version),
    limits: loaded.limits as Record<string, unknown>,
    diagnostics: loaded.diagnostics as Record<string, unknown>,
    contextDimensions: loaded["context-dimensions"] as Record<string, unknown>,
    forcedColors: loaded["forced-colors"] as Record<string, unknown>,
    transformations: loaded.transformations as Record<string, unknown>,
    rules: loaded.rules as Record<string, unknown>,
    semanticBaseline: loaded["semantic-baseline"] as Record<string, unknown>,
    componentCatalog: loaded["component-catalog"] as Record<string, unknown>,
    customizationPoints: loaded["customization-points"] as Record<
      string,
      unknown
    >,
  };
}
