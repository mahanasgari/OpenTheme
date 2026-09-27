import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../src",
);

const MATH_FORBIDDEN =
  /\bMath\.(pow|cbrt|sin|cos|tan|log|log2|log10|exp|expm1|hypot|atan2|fround|round)\b/;
const POW_OP = /(?<![\w$.])\*\*(?![\w$])/;
const NETWORK_FORBIDDEN =
  /\b(fetch|XMLHttpRequest|WebSocket)\b|node:https?|node:net|from ["']https?:/;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("no platform math / no network", () => {
  const mathDirs = ["kernels", "color", "transforms"].map((d) =>
    join(SRC_ROOT, d),
  );
  const mathFiles = mathDirs.flatMap((d) => {
    try {
      return walk(d);
    } catch {
      return [];
    }
  });

  it("forbids platform math in kernels/color/transforms", () => {
    const offenders: string[] = [];
    for (const file of mathFiles) {
      const text = stripComments(readFileSync(file, "utf8"));
      if (MATH_FORBIDDEN.test(text) || POW_OP.test(text)) {
        offenders.push(relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("forbids network access in reference-checker src", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const text = stripComments(readFileSync(file, "utf8"));
      if (NETWORK_FORBIDDEN.test(text)) {
        offenders.push(relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
