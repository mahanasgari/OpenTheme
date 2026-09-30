/**
 * `opentheme css <theme>` (US4; FR-T050): the Web adapter's stylesheet or style element for the
 * resolved theme, to standard output or a file.
 */
import { toStylesheet } from "@opentheme/web";
import { CONTEXT_OPTIONS, contextOptions, INPUT_OPTIONS, parse } from "../args.js";
import { clean, toJson } from "../format.js";
import { type Io, UsageError, writeOutput } from "../io.js";
import { fallbackNotice, loadTheme, resolveTheme } from "../theme.js";

const HELP = `Usage: opentheme css <theme> [options]

Writes the CSS custom properties the Web adapter produces for a theme and context.

  --scope <id>         An element scope ([data-opentheme-scope="<id>"]) instead of :root
  --element            A complete <style data-opentheme-scope> element (server rendering)
  --nonce <nonce>      A CSP nonce for the element
  --out <file>         Write to a file (refuses to overwrite without --force)
  --force              Overwrite --out
Context: --scheme --contrast --forced-colors --reduced-motion --text-scale --size --locale --dir
Inputs:  --trusted --source --base --host --relaxed-gate   Output: --json --no-color
`;

const SCOPE = /^[a-z][a-z0-9-]*$/;

export function css(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, {
    ...INPUT_OPTIONS,
    ...CONTEXT_OPTIONS,
    scope: { type: "string" },
    element: { type: "boolean" },
    nonce: { type: "string" },
    out: { type: "string" },
    force: { type: "boolean" },
  });
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  const context = contextOptions(values);
  const scope = typeof values.scope === "string" ? values.scope : undefined;
  if (scope !== undefined && !SCOPE.test(scope)) throw new UsageError("--scope must match [a-z][a-z0-9-]*");
  const nonce = typeof values.nonce === "string" ? values.nonce : undefined;
  if (nonce !== undefined && !/^[A-Za-z0-9+/_=-]+$/.test(nonce)) throw new UsageError("--nonce must be base64 or base64url");
  const element = values.element === true;
  const loaded = loadTheme("css", values, positionals, io);
  if (typeof loaded === "number") return loaded;
  const r = resolveTheme(loaded, context);
  // A document-scope element still needs an id for adoption; `opentheme` is the default.
  const text = `${toStylesheet(r.result.resolved, {
    ...(scope !== undefined ? { scope } : element ? { scope: "opentheme", root: true } : {}),
    ...(nonce !== undefined ? { nonce } : {}),
    element,
  })}\n`;
  const status = r.fallback ? 1 : 0;
  const out = typeof values.out === "string" ? values.out : undefined;
  if (out) writeOutput(out, text, values.force === true);
  if (values.json) {
    io.stdout(toJson({ command: "css", ...(loaded.options.relaxedGate ? { gate: "relaxed" } : {}), path: loaded.path, ...(out ? { output: out } : { text }), status }));
    return status;
  }
  io.stderr(fallbackNotice(r, loaded.styler));
  if (out) io.stdout(`${clean(loaded.path)}: wrote ${clean(out)}\n`);
  else io.stdout(text);
  return status;
}
