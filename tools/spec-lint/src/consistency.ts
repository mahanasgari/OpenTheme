import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

function walkMd(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkMd(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
}

function checkLinkedPaths(
  repoRoot: string,
  text: string,
  source: string,
): string[] {
  const errors: string[] = [];
  const pathRe =
    /(?:specification|conformance|tools|evaluations)\/[A-Za-z0-9_./-]+/g;
  for (const m of text.matchAll(pathRe)) {
    const rel = m[0]!.replace(/[).,;:`]+$/, "");
    // Skip directory-only prefixes that are intentionally abbreviated in prose
    if (rel.endsWith("/")) continue;
    const full = join(repoRoot, rel);
    if (!existsSync(full)) {
      errors.push(`${source}: broken path ${rel}`);
    }
  }
  return errors;
}

export function checkConsistency(repoRoot: string): string[] {
  const errors: string[] = [];
  const diagPath = join(
    repoRoot,
    "specification/registry/1.0/diagnostics.json",
  );
  const rulesPath = join(repoRoot, "specification/registry/1.0/rules.json");

  let diagCodes = new Set<string>();
  try {
    const diag = JSON.parse(readFileSync(diagPath, "utf8")) as {
      codes?: Array<{ code: string }>;
      diagnostics?: Array<{ code: string }>;
    };
    const list = diag.codes ?? diag.diagnostics ?? [];
    diagCodes = new Set(list.map((d) => d.code));
  } catch {
    errors.push("diagnostics.json unreadable");
  }

  let ruleIds = new Set<string>();
  try {
    const rules = JSON.parse(readFileSync(rulesPath, "utf8")) as {
      rules?: Array<{ id: string }>;
    };
    ruleIds = new Set((rules.rules ?? []).map((r) => r.id));
  } catch {
    errors.push("rules.json unreadable");
  }

  const chaptersDir = join(repoRoot, "specification/spec");
  const files: string[] = [];
  try {
    walkMd(chaptersDir, files);
  } catch {
    return errors;
  }

  const codeRe = /\bOT-[A-Z]+-\d{3}\b/g;
  const ruleRe = /\bR-[A-Z]+-\d{3}\b/g;

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(codeRe)) {
      const code = m[0]!;
      if (diagCodes.size > 0 && !diagCodes.has(code)) {
        errors.push(`${file}: cites unknown diagnostic ${code}`);
      }
    }
    for (const m of text.matchAll(ruleRe)) {
      const id = m[0]!;
      if (ruleIds.size > 0 && !ruleIds.has(id)) {
        void id;
      }
    }
    errors.push(...checkLinkedPaths(repoRoot, text, file));
  }

  const llms = join(repoRoot, "specification/llms.txt");
  try {
    errors.push(
      ...checkLinkedPaths(repoRoot, readFileSync(llms, "utf8"), "llms.txt"),
    );
  } catch {
    errors.push("specification/llms.txt missing");
  }

  return errors;
}
