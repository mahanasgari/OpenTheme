/**
 * Bundle-size gate for @opentheme/core (research CR16): the public entry, bundled, minified, and
 * gzip-compressed, must stay within 100 KB. The optional English templates module is excluded
 * because the entry does not import it. esbuild is a devDependency used only for this check and
 * for bundling the precompiled validators.
 */
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const BUDGET_BYTES = 100 * 1024;
const here = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [path.join(here, "../dist/index.js")],
  bundle: true,
  minify: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  write: false,
  legalComments: "none",
});
const code = result.outputFiles[0]!.contents;
const gz = gzipSync(code, { level: 9 }).length;
process.stdout.write(
  `size:core minified=${code.length} B gzip=${gz} B budget=${BUDGET_BYTES} B\n`,
);
if (gz > BUDGET_BYTES) {
  process.stderr.write(`size:core over budget by ${gz - BUDGET_BYTES} B\n`);
  process.exit(1);
}
