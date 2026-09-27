/**
 * Domain-term scan (FR-088, SC-012 automated).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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

export function checkDomainTerms(repoRoot: string): string[] {
  const listPath = join(repoRoot, "tools/spec-lint/data/domain-terms.txt");
  if (!existsSync(listPath)) {
    return [`missing domain-terms list at ${listPath}`];
  }
  const terms = readFileSync(listPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (terms.length === 0) return [];

  const allowDirs = [
    join(repoRoot, "specification/hosts"),
    join(repoRoot, "specification/examples"),
  ];
  const targets = [
    ...walk(join(repoRoot, "specification/spec"), (n) => n.endsWith(".md")),
    ...walk(join(repoRoot, "specification/registry/1.0"), (n) =>
      n.endsWith(".json"),
    ),
    ...walk(join(repoRoot, "specification/schemas/1.0"), (n) =>
      n.endsWith(".json"),
    ),
  ];

  const errors: string[] = [];
  for (const file of targets) {
    if (allowDirs.some((d) => file.startsWith(d))) continue;
    const text = readFileSync(file, "utf8");
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) {
        errors.push(`${file}: forbidden domain term "${term}"`);
      }
    }
  }
  return errors;
}
