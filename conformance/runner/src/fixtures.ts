import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "../../..");
export const fixturesRoot = join(repoRoot, "conformance/fixtures");

export type FixtureFile = {
  id: string;
  path: string;
  kind: string;
  rules: string[];
  description: string;
  input: unknown;
  expect: Record<string, unknown>;
  profile?: string;
};

function walkJson(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJson(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
}

function validateFixtureShape(raw: Record<string, unknown>, path: string): string[] {
  const errors: string[] = [];
  for (const key of ["kind", "rules", "description", "input", "expect"]) {
    if (!(key in raw)) errors.push(`${path}: missing ${key}`);
  }
  if (raw.kind !== undefined && typeof raw.kind !== "string") {
    errors.push(`${path}: kind must be string`);
  }
  if (raw.rules !== undefined && !Array.isArray(raw.rules)) {
    errors.push(`${path}: rules must be array`);
  }
  return errors;
}

/** Discover all fixture JSON files under conformance/fixtures. */
export function discoverFixtures(filter?: string): FixtureFile[] {
  const files: string[] = [];
  walkJson(fixturesRoot, files);
  const fixtures: FixtureFile[] = [];
  const errors: string[] = [];

  for (const path of files.sort()) {
    const rel = relative(fixturesRoot, path).replace(/\\/g, "/");
    const id = rel.replace(/\.json$/, "");
    if (filter && !matchGlob(id, filter)) continue;

    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    errors.push(...validateFixtureShape(raw, rel));
    fixtures.push({
      id,
      path,
      kind: String(raw.kind),
      rules: raw.rules as string[],
      description: String(raw.description),
      input: raw.input,
      expect: raw.expect as Record<string, unknown>,
      ...(typeof raw.profile === "string" ? { profile: raw.profile } : {}),
    });
  }

  if (errors.length > 0) {
    throw new Error(`Fixture schema errors:\n${errors.join("\n")}`);
  }
  return fixtures;
}

/** Minimal glob: `*` and `**` segments. */
export function matchGlob(id: string, pattern: string): boolean {
  if (pattern === "*" || pattern === "**") return true;
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{DS}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{DS}}/g, ".*");
  return new RegExp(`^${esc}$`).test(id);
}
