/** Shared by the documentation tests: compile a `tsx` snippet and import it, against the built package. */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { AURORA, GRAPHITE, read } from "../helpers.js";

export const pkg = join(dirname(fileURLToPath(import.meta.url)), "../..");
// Inside the package, so `@opentheme/react` resolves through the package's own exports.
export const tmp = join(pkg, "test/docs/.examples");
export const PLACEHOLDERS = "declare const auroraBytes: string;\ndeclare const graphiteBytes: string;\n";

export function resetExamples(): void {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
}

/** The code of every fenced `tsx` block in a Markdown text. */
export function tsxBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```tsx\n([\s\S]*?)```/g)].map((m) => m[1]!);
}

/** Transpiles a block (JSX included), writes it next to the other examples, and imports it. */
export async function importBlock(name: string, code: string): Promise<Record<string, unknown>> {
  const js = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: `${name}.tsx`,
  }).outputText;
  const prelude = "const { auroraBytes, graphiteBytes } = globalThis.__openthemeDocs;\n";
  mkdirSync(tmp, { recursive: true });
  const file = join(tmp, `${name}.mjs`);
  writeFileSync(file, prelude + js);
  (globalThis as Record<string, unknown>).__openthemeDocs = { auroraBytes: read(AURORA), graphiteBytes: read(GRAPHITE) };
  return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, unknown>;
}
