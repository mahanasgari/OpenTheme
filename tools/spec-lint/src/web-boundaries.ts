/**
 * Web adapter boundary lint (specs/003-web-adapter T004; FR-W023, FR-W040 to FR-W042).
 * packages/web/src may import only Core's public entry and relative modules, and must not use
 * network APIs, cookies, Node built-ins, or dynamic code.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripCommentsAndStrings } from "./core-boundaries.js";

function walkTs(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (name.endsWith(".ts")) out.push(full);
  }
}

const IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const CODE_RULES: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/, "network (fetch)"],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/, "network API"],
  [/\.\s*cookie\b/, "cookies"],
  [/(?<![.\w])process\s*\./, "Node process object"],
  [/\brequire\s*\(/, "CommonJS require"],
  [/\beval\s*\(|\bnew\s+Function\b/, "dynamic code"],
  [/\.\s*(innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write\b/, "HTML string injection"],
];

export function importAllowed(spec: string): boolean {
  return spec === "@opentheme/core" || spec.startsWith("./") || spec.startsWith("../");
}

export function checkWebBoundaries(repoRoot: string): string[] {
  const srcRoot = join(repoRoot, "packages/web/src");
  if (!existsSync(srcRoot)) return [];
  const files: string[] = [];
  walkTs(srcRoot, files);
  const errors: string[] = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    const raw = readFileSync(file, "utf8");
    for (const m of raw.matchAll(IMPORT)) {
      const spec = m[1]!;
      if (!importAllowed(spec) || spec.includes("tools/")) {
        errors.push(`web-boundaries: ${rel}: imports ${spec} (only @opentheme/core and relative modules)`);
      }
    }
    const code = stripCommentsAndStrings(raw);
    code.split("\n").forEach((line, idx) => {
      for (const [re, what] of CODE_RULES) {
        if (re.test(line)) errors.push(`web-boundaries: ${rel}:${idx + 1}: ${what}`);
      }
    });
  }
  return errors;
}
