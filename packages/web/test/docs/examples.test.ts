/**
 * Documentation examples stay true (constitution XI, FR-W051, T032): every fenced `ts` block in
 * README.md and AGENTS.md is type-checked against the built `@opentheme/web` and `@opentheme/core`
 * declarations and then run in the DOM test environment. `auroraBytes`, `graphiteBytes`, and `notesHostBytes` are the documented placeholders.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";
import { AURORA, GRAPHITE, NOTES_HOST, read } from "../helpers.js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "../..");
// Inside the package, so `@opentheme/web` resolves through the package's own exports.
const tmp = join(pkg, "test/docs/.examples");
const PLACEHOLDERS = "declare const auroraBytes: string;\ndeclare const graphiteBytes: string;\ndeclare const notesHostBytes: string;\n";

const blocks: { name: string; code: string }[] = [];
for (const doc of ["README.md", "AGENTS.md"]) {
  const text = readFileSync(join(pkg, doc), "utf8");
  let i = 0;
  for (const m of text.matchAll(/```ts\n([\s\S]*?)```/g)) blocks.push({ name: `${doc.replace(".md", "")}-${++i}`, code: m[1]! });
}

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("documentation examples", () => {
  it("has examples in both documents", () => {
    expect(blocks.some((b) => b.name.startsWith("README"))).toBe(true);
    expect(blocks.some((b) => b.name.startsWith("AGENTS"))).toBe(true);
  });

  it("type-check against the built declarations", () => {
    for (const b of blocks) writeFileSync(join(tmp, `${b.name}.ts`), `${PLACEHOLDERS}${b.code}\nexport {};\n`);
    writeFileSync(
      join(tmp, "tsconfig.json"),
      JSON.stringify({
        extends: "../../../../../tsconfig.base.json",
        compilerOptions: { target: "ES2022", lib: ["ES2022", "DOM"], types: [], noEmit: true, module: "NodeNext", moduleResolution: "NodeNext" },
        include: ["*.ts"],
      }),
    );
    const tsc = join(pkg, "node_modules/typescript/bin/tsc");
    let output = "";
    try {
      execFileSync(process.execPath, [tsc, "-p", join(tmp, "tsconfig.json")], { stdio: "pipe" });
    } catch (e) {
      output = String((e as { stdout?: Buffer }).stdout ?? e);
    }
    expect(output).toBe("");
  });

  it.each(blocks.map((b) => [b.name, b] as const))("%s runs", async (_name, b) => {
    const js = ts.transpileModule(b.code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const prelude = `const { auroraBytes, graphiteBytes, notesHostBytes } = globalThis.__openthemeDocs;\n`;
    const file = join(tmp, `${b.name}.mjs`);
    writeFileSync(file, prelude + js);
    (globalThis as Record<string, unknown>).__openthemeDocs = { auroraBytes: read(AURORA), graphiteBytes: read(GRAPHITE), notesHostBytes: read(NOTES_HOST) };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await import(pathToFileURL(file).href);
      if (b.code.includes("// true")) expect(log.mock.calls.every((c) => c[0] !== false)).toBe(true);
    } finally {
      log.mockRestore();
      document.head.innerHTML = "";
      document.body.innerHTML = "";
      localStorage.clear();
    }
  });
});
