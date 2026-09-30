/**
 * `opentheme preview <theme>` (US5; research LR7; FR-T060): one self-contained page with a section
 * per supported color scheme at standard and high contrast. Each section is styled only by the Web
 * adapter's rule for that mode; the page loads nothing and contains no script.
 */
import { toStylesheet } from "@opentheme/web";
import { INPUT_OPTIONS, parse } from "../args.js";
import { toJson } from "../format.js";
import { type Io, writeOutput } from "../io.js";
import { TOOL_VERSION } from "../run.js";
import { fallbackNotice, loadTheme, resolveTheme } from "../theme.js";

const HELP = `Usage: opentheme preview <theme> [options]

Writes a self-contained HTML page showing sample components in every supported color scheme at
standard and high contrast. The page makes no network requests and runs no script.

  --out <file>         Output file (default: <theme>.preview.html)
  --force              Overwrite the output file
  --trusted --source --base --host --relaxed-gate   --json --no-color
`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:system-ui,sans-serif;background:#f4f4f5;color:#18181b}
header{padding:24px 32px}header h1{margin:0 0 4px;font-size:24px}header p{margin:0;color:#52525b}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;padding:0 32px 32px}
.mode{display:flex;flex-direction:column;gap:var(--ot-space_5);padding:var(--ot-space_6);
  background:var(--ot-color_surface_base);color:var(--ot-color_text_primary);
  font-family:var(--ot-text_body___font-family);font-size:var(--ot-text_body___font-size);
  line-height:var(--ot-text_body___line-height);border-radius:var(--ot-radius_lg)}
.mode h2{margin:0;font-size:var(--ot-text_heading-4___font-size);font-weight:var(--ot-text_heading-4___font-weight)}
.muted{color:var(--ot-color_text_secondary);font-size:var(--ot-text_caption___font-size)}
.row{display:flex;flex-wrap:wrap;gap:var(--ot-space_3);align-items:center}
.button{min-height:var(--otc-std__button_container_min-height_default);padding:0 var(--otc-std__button_container_padding-inline_default);
  border:var(--otc-std__button_container_border_default);border-radius:var(--otc-std__button_container_corner-radius_default);
  background:var(--otc-std__button_container_background_default);color:var(--otc-std__button_label_color_default);
  font-family:var(--otc-std__button_label_typography_default___font-family);font-size:var(--otc-std__button_label_typography_default___font-size);
  font-weight:var(--otc-std__button_label_typography_default___font-weight)}
.button.secondary{background:var(--ot-color_action_secondary_background);color:var(--ot-color_action_secondary_text)}
.card{padding:var(--otc-std__card_container_padding_default);background:var(--otc-std__card_container_background_default);
  border:var(--otc-std__card_container_border_default);border-radius:var(--otc-std__card_container_corner-radius_default);
  box-shadow:var(--otc-std__card_container_elevation_default)}
.card h3{margin:0 0 var(--ot-space_2);color:var(--otc-std__card_title_color_default);font-size:var(--otc-std__card_title_typography_default___font-size)}
.card p{margin:0;color:var(--otc-std__card_body_color_default)}
.input{min-height:var(--otc-std__text-input_container_min-height_default);padding:0 var(--ot-space_4);
  background:var(--otc-std__text-input_container_background_default);color:var(--ot-color_text_primary);
  border:var(--otc-std__text-input_container_border_default);border-radius:var(--otc-std__text-input_container_corner-radius_default);font:inherit}
.tabs{display:flex;gap:var(--ot-space_2);border-bottom:var(--ot-border_width_thin) solid var(--ot-color_divider)}
.tab{padding:var(--ot-space_3) var(--ot-space_4);color:var(--ot-color_text_secondary)}
.tab.on{color:var(--ot-color_text_primary);border-bottom:var(--ot-border_width_thick) solid var(--ot-color_action_primary_background)}
.badge{padding:var(--ot-space_1) var(--ot-space_4);border-radius:var(--ot-radius_full);font-size:var(--ot-text_caption___font-size)}
.ok{background:var(--ot-color_status_success_background);color:var(--ot-color_status_success_foreground)}
.bad{background:var(--ot-color_status_danger_background);color:var(--ot-color_status_danger_foreground)}
a{color:var(--ot-color_link)}`;

const SAMPLE = `<div class="tabs"><span class="tab on">Overview</span><span class="tab">Activity</span></div>
<div class="card"><h3>Weekly summary</h3><p>Twelve notes were added. <a href="#">Three</a> need review.</p></div>
<div class="row"><button class="button" type="button">Primary</button><button class="button secondary" type="button">Secondary</button></div>
<input class="input" type="text" value="Text input" aria-label="Sample text input">
<div class="row"><span class="badge ok">Synced</span><span class="badge bad">2 conflicts</span></div>`;

export function preview(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, { ...INPUT_OPTIONS, out: { type: "string" }, force: { type: "boolean" } });
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  const loaded = loadTheme("preview", values, positionals, io);
  if (typeof loaded === "number") return loaded;
  const rules: string[] = [];
  const sections: string[] = [];
  let status = 0;
  let title = loaded.entry.id;
  for (const scheme of ["light", "dark"] as const) {
    for (const contrast of ["standard", "high"] as const) {
      const r = resolveTheme(loaded, {
        platform: { colorScheme: scheme, contrast, forcedColors: false, reducedMotion: false, textScale: 1 },
        environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
      });
      if (r.fallback) {
        io.stderr(fallbackNotice(r, loaded.styler));
        status = 1;
      }
      const ctx = r.result.resolved.context as { colorScheme: string };
      if (ctx.colorScheme !== scheme) continue; // the theme does not support this scheme
      const name = (r.result.resolved.displayText as { name?: unknown }).name;
      if (typeof name === "string") title = name;
      const scope = `${scheme}-${contrast}`;
      rules.push(toStylesheet(r.result.resolved, { scope }));
      sections.push(
        `<section class="mode" data-opentheme-scope="${scope}" aria-label="${scheme}, ${contrast} contrast">\n` +
          `<h2>${scheme === "light" ? "Light" : "Dark"} · ${contrast} contrast</h2>\n${SAMPLE}\n</section>`,
      );
    }
  }
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · OpenTheme preview</title>
<style>
${rules.join("\n")}
${BASE_CSS}
</style>
</head>
<body>
<header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(`${loaded.entry.id}@${loaded.entry.version}`)} · generated by opentheme ${TOOL_VERSION}</p></header>
<main>
${sections.join("\n")}
</main>
</body>
</html>
`;
  const out = typeof values.out === "string" ? values.out : `${loaded.path.replace(/\.json$/, "")}.preview.html`;
  writeOutput(out, html, values.force === true);
  if (values.json) io.stdout(toJson({ command: "preview", ...(loaded.options.relaxedGate ? { gate: "relaxed" } : {}), path: loaded.path, output: out, modes: sections.length, status }));
  else io.stdout(`${loaded.path}: wrote ${out} (${sections.length} modes)\n`);
  return status;
}
