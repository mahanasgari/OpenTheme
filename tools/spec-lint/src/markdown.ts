import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function checkMarkdown(repoRoot: string): string[] {
  const errors: string[] = [];
  const target = join(repoRoot, "specification");
  const result = spawnSync(
    "pnpm",
    ["exec", "markdownlint-cli2", `${target}/**/*.md`],
    {
      cwd: join(repoRoot, "tools/spec-lint"),
      encoding: "utf8",
      shell: false,
    },
  );
  if (result.status !== 0) {
    const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    if (out) errors.push(out);
    else errors.push(`markdownlint exited ${result.status}`);
  }
  return errors;
}
