/**
 * Bundle-size gate for @opentheme/react (SC-R005, research RR8): the public entry, bundled with
 * react, @opentheme/core, and @opentheme/web external, minified, and gzip-compressed, must stay
 * within 3 KB.
 */
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const BUDGET_BYTES = 3 * 1024;
const here = path.dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [path.join(here, "../dist/index.js")],
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["react", "react/jsx-runtime", "@opentheme/core", "@opentheme/web"],
  write: false,
  legalComments: "none",
});
const code = result.outputFiles[0]!.contents;
const gz = gzipSync(code, { level: 9 }).length;
process.stdout.write(`size:react minified=${code.length} B gzip=${gz} B budget=${BUDGET_BYTES} B\n`);
if (gz > BUDGET_BYTES) {
  process.stderr.write(`size:react over budget by ${gz - BUDGET_BYTES} B\n`);
  process.exit(1);
}
