#!/usr/bin/env node
/**
 * Release gate (research R21). Fails closed on draft labels, pending licenses,
 * missing maintainers, missing evaluation results, or failing verify.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

function walk(dir: string, pred: (n: string) => boolean): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, pred));
    else if (pred(name)) out.push(full);
  }
  return out;
}

function main(): void {
  const errors: string[] = [];

  for (const file of walk(join(repoRoot, "specification"), (n) =>
    n.endsWith(".json") || n.endsWith(".md"),
  )) {
    const text = readFileSync(file, "utf8");
    if (text.includes("LicenseRef-OpenTheme-Pending")) {
      errors.push(`pending license: ${file}`);
    }
  }

  const constitution = join(repoRoot, ".specify/memory/constitution.md");
  if (!existsSync(constitution)) {
    errors.push("missing .specify/memory/constitution.md");
  } else {
    const text = readFileSync(constitution, "utf8");
    if (!/maintainer/i.test(text)) {
      errors.push("constitution.md has no maintainer list");
    }
  }

  const intro = join(
    repoRoot,
    "specification/spec/00-introduction-and-conformance.md",
  );
  if (existsSync(intro)) {
    const text = readFileSync(intro, "utf8");
    if (/draft/i.test(text) || /1\.0\.0-draft/.test(text)) {
      errors.push("specification still carries a draft label");
    }
  }

  const results = join(repoRoot, "evaluations/results.json");
  if (!existsSync(results)) {
    errors.push("missing evaluations/results.json");
  } else {
    try {
      const doc = JSON.parse(readFileSync(results, "utf8")) as {
        evaluations?: Array<{ id?: string; status?: string }>;
      };
      const pending = (doc.evaluations ?? []).filter(
        (e) => e.status !== "pass",
      );
      if (pending.length > 0) {
        errors.push(
          `evaluations not all passing: ${pending.map((e) => e.id).join(",")}`,
        );
      }
    } catch (err) {
      errors.push(`evaluations/results.json: ${(err as Error).message}`);
    }
  }

  if (process.env.OPENTHEME_RELEASE_SKIP_VERIFY !== "1") {
    const verify = spawnSync("pnpm", ["run", "verify"], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: true,
    });
    if (verify.status !== 0) {
      errors.push("pnpm verify failed");
    }
  }

  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`release-check: ${e}\n`);
    process.exit(1);
  }
  process.stderr.write("release-check: ok\n");
  process.exit(0);
}

main();
