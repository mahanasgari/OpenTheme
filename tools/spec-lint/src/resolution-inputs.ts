import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import AjvModule from "ajv/dist/2020.js";
import type { AnySchema, ErrorObject } from "ajv";

type ValidateFn = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };
type AjvConstructor = new (options?: object) => { compile: (schema: AnySchema) => ValidateFn };

const Ajv2020 =
  (AjvModule as unknown as { default?: AjvConstructor }).default ??
  (AjvModule as unknown as AjvConstructor);

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
}

/**
 * Every `resolve` fixture input must conform to the normative resolution input schema, so the
 * schema, the resolution contract, and the fixtures cannot drift apart (e.g., per-document trust).
 */
export function checkResolutionInputs(repoRoot: string): string[] {
  const errors: string[] = [];
  const schema = JSON.parse(
    readFileSync(
      join(repoRoot, "specification/schemas/1.0/resolution-input.schema.json"),
      "utf8",
    ),
  ) as AnySchema;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

  const files: string[] = [];
  walk(join(repoRoot, "conformance/fixtures"), files);
  for (const file of files.sort()) {
    let fixture: { kind?: unknown; input?: unknown };
    try {
      fixture = JSON.parse(readFileSync(file, "utf8")) as typeof fixture;
    } catch {
      continue; // parse failures are reported by other checks
    }
    if (fixture.kind !== "resolve") continue;
    if (!validate(fixture.input)) {
      const rel = relative(repoRoot, file).replace(/\\/g, "/");
      for (const e of validate.errors ?? []) {
        errors.push(`${rel}: input${e.instancePath} ${e.message ?? "invalid"}`);
      }
    }
  }
  return errors;
}
