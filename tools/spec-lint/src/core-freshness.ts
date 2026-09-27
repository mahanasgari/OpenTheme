/**
 * Core generated-artifact freshness (specs/002-core-runtime T023): every input recorded in
 * packages/core/src/generated/.stamp.json must still have the recorded SHA-256, and every
 * current input must be recorded. Regenerate with `pnpm --filter @opentheme/core run generate`.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function schemaFiles(repoRoot: string, dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...schemaFiles(repoRoot, full));
    else if (name.endsWith(".schema.json")) out.push(relative(repoRoot, full).replace(/\\/g, "/"));
  }
  return out;
}

export function checkCoreFreshness(repoRoot: string): string[] {
  const stampPath = join(repoRoot, "packages/core/src/generated/.stamp.json");
  if (!existsSync(join(repoRoot, "packages/core"))) return [];
  if (!existsSync(stampPath)) {
    return ["core generated artifacts missing: run pnpm --filter @opentheme/core run generate"];
  }
  const stamp = JSON.parse(readFileSync(stampPath, "utf8")) as { inputs: Record<string, string> };
  const errors: string[] = [];
  for (const [rel, hash] of Object.entries(stamp.inputs)) {
    const full = join(repoRoot, rel);
    if (!existsSync(full)) {
      errors.push(`core generated artifacts stale: input removed ${rel}`);
      continue;
    }
    const current = createHash("sha256").update(readFileSync(full)).digest("hex");
    if (current !== hash) errors.push(`core generated artifacts stale for ${rel}`);
  }
  for (const rel of schemaFiles(repoRoot, join(repoRoot, "specification/schemas"))) {
    if (!(rel in stamp.inputs)) errors.push(`core generated artifacts stale: new input ${rel}`);
  }
  return errors;
}
