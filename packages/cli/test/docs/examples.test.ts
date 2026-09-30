/**
 * Documentation examples stay true (FR-T080, SC-T007; T030): every `opentheme` line in a fenced
 * `bash` block of README.md and AGENTS.md runs against the built binary, in order, in one
 * temporary directory, and exits 0.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT, tempDir } from "../helpers.js";

const BIN = join(ROOT, "packages/cli/dist/main.js");
const tmp = tempDir();
afterAll(tmp.remove);

/** Splits a command line with single and double quotes, as a shell would for these examples. */
function words(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let has = false;
  for (const c of line) {
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === " ") {
      if (cur || has) out.push(cur);
      cur = "";
      has = false;
    } else cur += c;
  }
  if (cur || has) out.push(cur);
  return out;
}

const lines: { doc: string; line: string }[] = [];
for (const doc of ["README.md", "AGENTS.md"]) {
  const text = readFileSync(join(ROOT, "packages/cli", doc), "utf8");
  for (const m of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
    for (const line of m[1]!.split("\n")) if (line.startsWith("opentheme ")) lines.push({ doc, line });
  }
}

describe.skipIf(!existsSync(BIN))("documentation examples", () => {
  it("has examples in both documents", () => {
    expect(lines.some((l) => l.doc === "README.md")).toBe(true);
    expect(lines.some((l) => l.doc === "AGENTS.md")).toBe(true);
  });

  it.each(lines.map((l, i) => [`${l.doc}: ${l.line}`, l, i] as const))("%s", (_n, l) => {
    const r = spawnSync(process.execPath, [BIN, ...words(l.line).slice(1)], { cwd: tmp.dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
  });
});
