import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function collectSchemas(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSchemas(full)));
    else if (entry.name.endsWith(".schema.json")) files.push(full);
  }
  return files.sort();
}

export async function checkGeneratedTypesFresh(
  repoRoot: string,
): Promise<string[]> {
  const errors: string[] = [];
  const stampPath = path.join(
    repoRoot,
    "tools/types/src/generated/.stamp.json",
  );
  let stamp: { schemas?: { path: string; mtimeMs: number }[] };
  try {
    stamp = JSON.parse(await readFile(stampPath, "utf8")) as typeof stamp;
  } catch {
    errors.push(
      "generated types missing: run pnpm --filter @opentheme/types run generate",
    );
    return errors;
  }
  const schemasRoot = path.join(repoRoot, "specification/schemas");
  const current = await collectSchemas(schemasRoot);
  const stamped = new Map(
    (stamp.schemas ?? []).map((s) => [s.path, s.mtimeMs]),
  );
  if (stamped.size !== current.length) {
    errors.push(
      `generated types stale: stamp has ${stamped.size} schemas, disk has ${current.length}`,
    );
  }
  for (const schemaPath of current) {
    const rel = path.relative(repoRoot, schemaPath).replace(/\\/g, "/");
    const mtime = (await stat(schemaPath)).mtimeMs;
    const prev = stamped.get(rel);
    if (prev === undefined || Math.abs(prev - mtime) > 1) {
      errors.push(`generated types stale for ${rel}`);
    }
  }
  return errors;
}
