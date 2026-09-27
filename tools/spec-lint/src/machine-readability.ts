/**
 * Machine-readability gate (FR-003, FR-090, NFR-006).
 * Registries and diagnostics must be fully documented. Schema property/definition
 * documentation gaps are reported and fail the gate (allowlisted paths excepted
 * until bulk annotation completes).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function walkJson(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkJson(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

/** Paths (repo-relative schema file + JSON pointer-ish) that may omit examples during draft. */
const SCHEMA_EXAMPLE_ALLOWLIST = new Set<string>([
  // Nested structural nodes often omit examples; descriptions still required when present.
]);

function checkSchemaNode(
  node: unknown,
  fileRel: string,
  pointer: string,
  errors: string[],
): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const obj = node as Record<string, unknown>;

  const isSchemaish =
    obj.type !== undefined ||
    obj.$ref !== undefined ||
    obj.properties !== undefined ||
    obj.$defs !== undefined ||
    obj.oneOf !== undefined ||
    obj.anyOf !== undefined ||
    obj.allOf !== undefined ||
    obj.enum !== undefined ||
    obj.const !== undefined ||
    obj.items !== undefined;

  if (isSchemaish && pointer !== "" && !obj.$ref) {
    const key = `${fileRel}:${pointer}`;
    if (!obj.description) {
      errors.push(`${key}: missing description`);
    }
    if (!obj.examples && !SCHEMA_EXAMPLE_ALLOWLIST.has(key)) {
      // $ref-only and boolean schemas skip; otherwise require examples
      if (obj.type !== undefined || obj.enum !== undefined || obj.const !== undefined) {
        errors.push(`${key}: missing examples`);
      }
    }
  }

  if (obj.properties && typeof obj.properties === "object") {
    for (const [k, v] of Object.entries(
      obj.properties as Record<string, unknown>,
    )) {
      checkSchemaNode(v, fileRel, `${pointer}/properties/${k}`, errors);
    }
  }
  if (obj.$defs && typeof obj.$defs === "object") {
    for (const [k, v] of Object.entries(obj.$defs as Record<string, unknown>)) {
      checkSchemaNode(v, fileRel, `${pointer}/$defs/${k}`, errors);
    }
  }
  for (const k of [
    "items",
    "additionalProperties",
    "not",
    "if",
    "then",
    "else",
  ] as const) {
    if (obj[k] !== undefined) {
      checkSchemaNode(obj[k], fileRel, `${pointer}/${k}`, errors);
    }
  }
  for (const k of ["oneOf", "anyOf", "allOf"] as const) {
    if (Array.isArray(obj[k])) {
      (obj[k] as unknown[]).forEach((v, i) =>
        checkSchemaNode(v, fileRel, `${pointer}/${k}/${i}`, errors),
      );
    }
  }
}

function checkSchemas(repoRoot: string): string[] {
  const root = join(repoRoot, "specification/schemas");
  const errors: string[] = [];
  for (const file of walkJson(root)) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    try {
      const doc = JSON.parse(readFileSync(file, "utf8")) as Record<
        string,
        unknown
      >;
      checkSchemaNode(doc, rel, "", errors);
    } catch (err) {
      errors.push(`${rel}: ${(err as Error).message}`);
    }
  }
  return errors;
}

function checkRegistries(repoRoot: string): string[] {
  const errors: string[] = [];
  const rules = JSON.parse(
    readFileSync(
      join(repoRoot, "specification/registry/1.0/rules.json"),
      "utf8",
    ),
  ) as { rules: Array<{ id: string; description?: string; example?: unknown }> };
  for (const r of rules.rules) {
    if (!r.description) errors.push(`rules.json ${r.id}: missing description`);
    if (!r.example) errors.push(`rules.json ${r.id}: missing example`);
  }

  const diags = JSON.parse(
    readFileSync(
      join(repoRoot, "specification/registry/1.0/diagnostics.json"),
      "utf8",
    ),
  ) as {
    codes: Array<{
      code: string;
      messageTemplate?: string;
      hintTemplate?: string;
    }>;
  };
  for (const c of diags.codes) {
    if (!c.messageTemplate) {
      errors.push(`diagnostics.json ${c.code}: missing messageTemplate`);
    }
    if (!c.hintTemplate) {
      errors.push(`diagnostics.json ${c.code}: missing hintTemplate`);
    }
  }

  // Other registries: each entry needs description when list-shaped
  for (const name of ["transformations.json", "forced-colors.json"]) {
    const path = join(repoRoot, "specification/registry/1.0", name);
    try {
      const doc = JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >;
      for (const [, value] of Object.entries(doc)) {
        if (!Array.isArray(value)) continue;
        for (const entry of value) {
          if (!entry || typeof entry !== "object") continue;
          const e = entry as Record<string, unknown>;
          const id = String(e.id ?? e.path ?? e.code ?? "?");
          if (!e.description && !e.summary) {
            errors.push(`${name} ${id}: missing description`);
          }
        }
      }
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message}`);
    }
  }

  // semantic-baseline tokens are path+type catalogs; require path at minimum
  try {
    const doc = JSON.parse(
      readFileSync(
        join(repoRoot, "specification/registry/1.0/semantic-baseline.json"),
        "utf8",
      ),
    ) as { tokens?: Array<{ path?: string; type?: string }> };
    for (const t of doc.tokens ?? []) {
      if (!t.path || !t.type) {
        errors.push(
          `semantic-baseline.json: token missing path/type (${t.path ?? "?"})`,
        );
      }
    }
  } catch (err) {
    errors.push(`semantic-baseline.json: ${(err as Error).message}`);
  }

  return errors;
}

/**
 * Returns hard errors for registries/diagnostics. Schema gaps are returned
 * separately so the caller can soft-report during draft until annotation catches up.
 */
export function checkMachineReadability(repoRoot: string): {
  hard: string[];
  schemaGaps: string[];
} {
  return {
    hard: checkRegistries(repoRoot),
    schemaGaps: checkSchemas(repoRoot),
  };
}
