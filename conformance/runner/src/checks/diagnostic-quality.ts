/**
 * Automated SC-005 check: every diagnostic from invalid/malicious fixtures has
 * code, location, and a hint template in diagnostics.json.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DiagnosticLike = {
  code?: string;
  location?: { document?: string; pointer?: string };
  hint?: string;
};

export function checkDiagnosticQuality(
  diagnostics: DiagnosticLike[],
  diagnosticsRegistryPath: string,
): string[] {
  const registry = JSON.parse(readFileSync(diagnosticsRegistryPath, "utf8")) as {
    codes?: Array<{ code: string; hint?: string; hintTemplate?: string }>;
    diagnostics?: Array<{ code: string; hint?: string; hintTemplate?: string }>;
  };
  const list = registry.codes ?? registry.diagnostics ?? [];
  const byCode = new Map(list.map((d) => [d.code, d]));
  const failures: string[] = [];

  for (const d of diagnostics) {
    if (!d.code) {
      failures.push("diagnostic missing code");
      continue;
    }
    if (!d.location?.document || d.location.pointer === undefined) {
      failures.push(`${d.code}: missing location`);
    }
    const entry = byCode.get(d.code);
    if (!entry) {
      failures.push(`${d.code}: not in diagnostics.json`);
      continue;
    }
    if (!entry.hint && !entry.hintTemplate) {
      failures.push(`${d.code}: missing hint template`);
    }
  }
  return failures;
}

export function registryPath(repoRoot: string): string {
  return join(repoRoot, "specification/registry/1.0/diagnostics.json");
}
