/** The public surface (FR-C101, FR-C104; contracts/public-api.md). */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as api from "../../src/index.js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("public surface", () => {
  it("exports exactly the documented runtime values", () => {
    expect(Object.keys(api).sort()).toEqual([
      "OPERATIONAL_ERROR_KINDS",
      "OpenThemeCoreError",
      "PRESETS",
      "SUPPORTED",
      "createCore",
      "createMemoryStore",
    ]);
  });

  it("declares no DOM, Node, or framework types", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const f = join(d, n);
        if (statSync(f).isDirectory()) walk(f);
        else if (n.endsWith(".d.ts")) files.push(f);
      }
    };
    walk(join(pkg, "dist"));
    expect(files.length).toBeGreaterThan(10);
    const forbidden = /\b(HTMLElement|Window|Document|Element|EventTarget|NodeJS|Buffer|ReadableStream|React|Vue|Svelte|localStorage)\b/;
    for (const f of files) {
      const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(forbidden.exec(text)?.[0], f).toBeUndefined();
    }
  });

  it("type-checks a consumer that uses only package exports", () => {
    const tsc = join(pkg, "node_modules/typescript/bin/tsc");
    expect(() => execFileSync(process.execPath, [tsc, "-p", join(pkg, "test/api/tsconfig.json")], { stdio: "pipe" })).not.toThrow();
  });
});
