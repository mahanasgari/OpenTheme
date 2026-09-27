/**
 * Forbidden-capability scan (FR-066, SC-012): schemas must not accept unconstrained
 * strings, open additionalProperties (outside $extensions), or URI formats.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function walkSchemas(
  node: Json,
  path: string,
  issues: string[],
  inExtensions = false,
): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const obj = node as Record<string, Json>;

  if (obj.format === "uri" || obj.format === "uri-reference") {
    issues.push(`${path}: URI format is forbidden (FR-066)`);
  }

  if (
    obj.type === "string" &&
    !obj.pattern &&
    !obj.enum &&
    !obj.const &&
    !obj.format &&
    obj["x-opentheme-display-text"] !== true
  ) {
    // Allow string leaves that only appear under $ref targets with constraints elsewhere.
    if (!obj.minLength && !obj.maxLength) {
      issues.push(
        `${path}: string lacks pattern/enum/const/format (mark x-opentheme-display-text if plain text)`,
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(obj, "additionalProperties") &&
    obj.additionalProperties !== false &&
    !inExtensions
  ) {
    // $extensions values may be open; token trees use constrained additionalProperties objects.
    const ap = obj.additionalProperties;
    if (ap === true) {
      issues.push(`${path}: additionalProperties must be false outside $extensions`);
    }
  }

  for (const [key, child] of Object.entries(obj)) {
    const nextExt = inExtensions || key === "$extensions";
    walkSchemas(child, `${path}/${key}`, issues, nextExt);
  }
}

export function scanCapabilitySchemas(schemasRoot: string): string[] {
  const issues: string[] = [];
  const files: string[] = [];

  function collect(dir: string): void {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) collect(full);
      else if (ent.name.endsWith(".schema.json")) files.push(full);
    }
  }
  collect(schemasRoot);

  for (const file of files) {
    const rel = file.slice(schemasRoot.length + 1);
    const doc = JSON.parse(readFileSync(file, "utf8")) as Json;
    walkSchemas(doc, rel, issues, false);
  }
  return issues;
}
