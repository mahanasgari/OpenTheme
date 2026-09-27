/**
 * Core boundary lint (specs/002-core-runtime T024; FR-C001, FR-C005; research CR1, CR2).
 * packages/core/src must not import the reference checker or Node built-ins, and must not use
 * network, storage, DOM, clock, randomness, timers, or dynamic code. Normative numeric modules
 * must not use platform math (AGENTS.md invariant 2).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function walkTs(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (name.endsWith(".ts")) out.push(full);
  }
}

/** Remove comments and string/template literal contents so prose cannot trigger rules. */
export function stripCommentsAndStrings(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += quote;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i += 1;
        i += 1;
      }
      out += quote;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const IMPORT_RULES: Array<[RegExp, string]> = [
  [/from\s+["'](node:[^"']+)["']/g, "imports a Node built-in"],
  [/from\s+["'](@opentheme\/reference-checker[^"']*)["']/g, "imports the reference checker"],
  [/from\s+["']([^"']*tools\/reference-checker[^"']*)["']/g, "imports the reference checker"],
];

const CODE_RULES: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/, "network (fetch)"],
  [/\bXMLHttpRequest\b|\bWebSocket\b/, "network API"],
  [/(?<![.\w])Date\b/, "clock (Date)"],
  [/(?<![.\w])performance\s*\./, "clock (performance)"],
  [/\bMath\s*\.\s*random\b/, "randomness (Math.random)"],
  [/(?<![.\w])crypto\b/, "platform crypto"],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, "platform storage"],
  [/(?<![.\w])(document|window|navigator|globalThis)\s*\./, "DOM or global platform object"],
  [/(?<![.\w])process\s*\./, "Node process object"],
  [/\brequire\s*\(/, "CommonJS require"],
  [/\b(setTimeout|setInterval|setImmediate|queueMicrotask)\b/, "timers"],
  [/\beval\s*\(|\bnew\s+Function\b/, "dynamic code"],
];

const PLATFORM_MATH =
  /\bMath\s*\.\s*(pow|cbrt|sin|cos|tan|log|log2|log10|exp|hypot|atan2|atan|asin|acos|fround|round)\b|\*\*/;

export function checkCoreBoundaries(repoRoot: string): string[] {
  const srcRoot = join(repoRoot, "packages/core/src");
  if (!existsSync(srcRoot)) return [];
  const files: string[] = [];
  walkTs(srcRoot, files);
  const errors: string[] = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    const raw = readFileSync(file, "utf8");
    const generated = rel.startsWith("packages/core/src/generated/");
    if (generated) {
      // Generated validators embed Ajv helper code; only dynamic code is checked there.
      if (/\beval\s*\(|\bnew\s+Function\b/.test(stripCommentsAndStrings(raw))) {
        errors.push(`core-boundaries: ${rel}: dynamic code`);
      }
      continue;
    }
    for (const [re, what] of IMPORT_RULES) {
      for (const m of raw.matchAll(re)) errors.push(`core-boundaries: ${rel}: ${what} (${m[1]})`);
    }
    const code = stripCommentsAndStrings(raw);
    code.split("\n").forEach((line, idx) => {
      for (const [re, what] of CODE_RULES) {
        if (re.test(line)) errors.push(`core-boundaries: ${rel}:${idx + 1}: ${what}`);
      }
      if (/\/(kernels|color|transforms)\//.test(rel) && PLATFORM_MATH.test(line)) {
        errors.push(`core-boundaries: ${rel}:${idx + 1}: platform math in a normative numeric module`);
      }
    });
  }
  return errors;
}
