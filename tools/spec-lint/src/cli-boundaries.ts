/**
 * Command-line tool boundary lint (specs/004-theme-author-cli T003; FR-T003, FR-T004).
 * packages/cli/src may import only OpenTheme Core (public entry and templates), the Web adapter,
 * relative modules, and a fixed set of Node built-ins: never network modules, child processes,
 * `vm`, workers, or dynamic code.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripCommentsAndStrings } from "./core-boundaries.js";

const ALLOWED = new Set([
  "@opentheme/core",
  "@opentheme/core/templates",
  "@opentheme/web",
  "node:util",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:crypto",
  "node:process",
  "node:url",
]);

const IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const CODE_RULES: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/, "network (fetch)"],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/, "network API"],
  [/\brequire\s*\(/, "CommonJS require"],
  [/\beval\s*\(|\bnew\s+Function\b/, "dynamic code"],
];

function walkTs(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (name.endsWith(".ts")) out.push(full);
  }
}

export function checkCliBoundaries(repoRoot: string): string[] {
  const srcRoot = join(repoRoot, "packages/cli/src");
  if (!existsSync(srcRoot)) return [];
  const files: string[] = [];
  walkTs(srcRoot, files);
  const errors: string[] = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    const raw = readFileSync(file, "utf8");
    for (const m of raw.matchAll(IMPORT)) {
      const spec = m[1]!;
      if (!ALLOWED.has(spec) && !spec.startsWith("./") && !spec.startsWith("../")) {
        errors.push(`cli-boundaries: ${rel}: imports ${spec}`);
      }
    }
    stripCommentsAndStrings(raw).split("\n").forEach((line, idx) => {
      for (const [re, what] of CODE_RULES) if (re.test(line)) errors.push(`cli-boundaries: ${rel}:${idx + 1}: ${what}`);
    });
  }
  return errors;
}
