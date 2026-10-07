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
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
}

/** `… from "x"`, `import("x")`, and a bare `import "x"` statement (not the string "import"). */
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;

const CODE_RULES: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/, "network (fetch)"],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/, "network API"],
  [/\.\s*cookie\b/, "cookies"],
  [/(?<![.\w])process\s*\./, "Node process object"],
  [/\brequire\s*\(/, "CommonJS require"],
  [/\beval\s*\(|\bnew\s+Function\b/, "dynamic code"],
  [/\.\s*(innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write\b/, "HTML string injection"],
];

/** Extra bare specifiers a package may import besides Core and relative modules. */
const EXTRA_IMPORTS: Record<string, readonly string[]> = {
  "packages/react/src": ["react", "react/jsx-runtime", "@opentheme/web"],
};

export function importAllowed(spec: string, extra: readonly string[] = []): boolean {
  return spec === "@opentheme/core" || extra.includes(spec) || spec.startsWith("./") || spec.startsWith("../");
}

/**
 * The Web adapter, the design tokens interchange library, and the React bindings share these rules
 * (T003 of 005 and of 006). The React bindings may also import react and @opentheme/web.
 */
export function checkWebBoundaries(repoRoot: string): string[] {
  const files: Array<{ file: string; extra: readonly string[] }> = [];
  for (const pkg of ["packages/web/src", "packages/dtcg/src", "packages/react/src"]) {
    const srcRoot = join(repoRoot, pkg);
    const found: string[] = [];
    if (existsSync(srcRoot)) walkTs(srcRoot, found);
    for (const file of found) files.push({ file, extra: EXTRA_IMPORTS[pkg] ?? [] });
  }
  const errors: string[] = [];
  for (const { file, extra } of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    const raw = readFileSync(file, "utf8");
    for (const m of raw.matchAll(IMPORT)) {
      const spec = m[1]!;
      if (!importAllowed(spec, extra) || spec.includes("tools/")) {
        const allowed = ["@opentheme/core", ...extra].join(", ");
        errors.push(`web-boundaries: ${rel}: imports ${spec} (only ${allowed} and relative modules)`);
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
