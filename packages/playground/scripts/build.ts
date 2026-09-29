/**
 * Builds dist/index.html: one self-contained page (no network requests) with the reference themes
 * embedded, the app bundled, and the default theme's style element rendered ahead of time so the
 * first paint is already themed; the client adopts it (FR-W030).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCore } from "@opentheme/core";
import { toStylesheet } from "@opentheme/web";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const pkg = join(here, "..");

export function pageData() {
  const themes = [
    "specification/themes/reference/org.opentheme.aurora.opentheme.json",
    "specification/themes/reference/org.opentheme.graphite.opentheme.json",
  ].map((p) => {
    const bytes = readFileSync(join(root, p), "utf8");
    const doc = JSON.parse(bytes) as { id: string; name: string };
    return { id: doc.id, name: doc.name, bytes };
  });
  return { themes };
}

/** The server-rendered style element for the default theme, light scheme, medium size. */
export function prerender(data: ReturnType<typeof pageData>): string {
  const core = createCore();
  for (const t of data.themes) core.registry.admit({ kind: "theme", bytes: t.bytes, trust: "trusted" });
  const result = core.resolve(core.registry.snapshot(), {
    policy: { preset: "common-personalization", defaultTheme: data.themes[0]!.id },
    selection: { id: data.themes[0]!.id },
    previous: null,
    preferences: {},
    platform: { colorScheme: "no-preference", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
  });
  if (!result.ok) throw new Error(result.error.message);
  return toStylesheet(result.resolved, { scope: "playground", root: true, element: true });
}

async function main(): Promise<void> {
  const bundle = await build({
    entryPoints: [join(pkg, "src/main.ts")],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    legalComments: "none",
  });
  const data = pageData();
  // Embedded JSON must not close the script element.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const css = readFileSync(join(pkg, "src/styles.css"), "utf8");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>OpenTheme playground</title>
<meta name="description" content="Pick an OpenTheme theme, personalize it, and inspect the CSS custom properties that @opentheme/web writes.">
${prerender(data)}
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script type="application/json" id="data">${json}</script>
<script type="module">${bundle.outputFiles[0]!.text}</script>
</body>
</html>
`;
  mkdirSync(join(pkg, "dist"), { recursive: true });
  writeFileSync(join(pkg, "dist/index.html"), html);
  process.stdout.write(`playground: wrote dist/index.html (${(html.length / 1024).toFixed(0)} KiB)\n`);
}

if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
