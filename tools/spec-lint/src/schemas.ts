import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import AjvModule from "ajv/dist/2020.js";
import type { AnySchema, ErrorObject } from "ajv";

type AjvConstructor = new (options?: object) => {
  validateSchema: (schema: AnySchema) => boolean;
  errors: ErrorObject[] | null | undefined;
  addSchema: (schema: AnySchema, key?: string) => unknown;
};

const Ajv2020 =
  (AjvModule as unknown as { default?: AjvConstructor }).default ??
  (AjvModule as unknown as AjvConstructor);

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".schema.json")) out.push(full);
  }
}

export function checkSchemas(repoRoot: string): string[] {
  const errors: string[] = [];
  const schemasRoot = join(repoRoot, "specification/schemas");
  const files: string[] = [];
  walk(schemasRoot, files);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true,
  });

  for (const file of files) {
    try {
      const schema = JSON.parse(readFileSync(file, "utf8")) as {
        $id?: string;
      };
      if (schema.$id) {
        try {
          ajv.addSchema(schema as AnySchema);
        } catch {
          // already added
        }
      }
    } catch (err) {
      errors.push(
        `${relative(repoRoot, file)}: parse error ${(err as Error).message}`,
      );
    }
  }

  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    try {
      const schema = JSON.parse(readFileSync(file, "utf8")) as AnySchema;
      const valid = ajv.validateSchema(schema);
      if (!valid) {
        for (const e of ajv.errors ?? []) {
          errors.push(`${rel}: meta-schema ${e.instancePath} ${e.message}`);
        }
      }
    } catch (err) {
      errors.push(`${rel}: ${(err as Error).message}`);
    }
  }

  return errors;
}
