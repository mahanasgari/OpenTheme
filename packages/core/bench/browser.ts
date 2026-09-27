/**
 * Builds bench/dist/core-browser.html (tasks T084, T087): one self-contained page that runs the
 * cross-runtime determinism check and the R22 benchmarks in any browser engine. Open it on the
 * reference device before a release; the page title reports PASS or FAIL.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { resolutionCases } from "../test/determinism/cases.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const bundle = await build({
  entryPoints: [join(here, "browser-entry.ts")],
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  write: false,
});
const data = {
  cases: resolutionCases(),
  golden: JSON.parse(readFileSync(join(here, "../test/determinism/hashes.json"), "utf8")) as Record<string, string>,
  typical: readFileSync(join(root, "tools/bench/fixtures/typical.opentheme.json"), "utf8"),
  aurora: readFileSync(join(root, "specification/themes/reference/org.opentheme.aurora.opentheme.json"), "utf8"),
};
// Embedded JSON must not close the script element.
const json = JSON.stringify(data).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>OpenTheme Core: running</title></head>
<body><pre id="out">running…\n</pre>
<script type="application/json" id="data">${json}</script>
<script type="module">${bundle.outputFiles[0]!.text}</script></body></html>
`;
mkdirSync(join(here, "dist"), { recursive: true });
const file = join(here, "dist/core-browser.html");
writeFileSync(file, html);
process.stdout.write(`bench:core:browser wrote ${file} (${(html.length / 1024).toFixed(0)} KiB); open it in a browser\n`);
