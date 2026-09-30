/**
 * `opentheme report <theme>` (US3; FR-T040): the chapter 11 accessibility conformance report
 * through Core's public API. Exit status 1 with --strict when there are findings.
 */
import { INPUT_OPTIONS, parse } from "../args.js";
import { formatDiagnostics, toJson, withText } from "../format.js";
import type { Io } from "../io.js";
import { loadTheme } from "../theme.js";

const HELP = `Usage: opentheme report <theme> [options]

Prints the accessibility conformance report (chapter 11) of a valid theme: every declared pair
below its threshold in any mode, with its location.

  --strict             Exit 1 when the report has findings
  --trusted  --source <source>  --base <file>  --host <file>  --relaxed-gate  --json  --no-color
`;

export function report(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, { ...INPUT_OPTIONS, strict: { type: "boolean" } });
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  const loaded = loadTheme("report", values, positionals, io);
  if (typeof loaded === "number") return loaded;
  const r = loaded.core.documents.accessibilityReport(loaded.entry, loaded.core.registry.snapshot());
  if ("ok" in r) throw new Error(r.error.message);
  const status = values.strict === true && r.diagnostics.length > 0 ? 1 : 0;
  if (values.json) {
    io.stdout(toJson({ command: "report", ...(loaded.options.relaxedGate ? { gate: "relaxed" } : {}), path: loaded.path, validity: r.validity, diagnostics: r.diagnostics.map(withText), status }));
    return status;
  }
  const s = loaded.styler;
  if (r.diagnostics.length === 0) {
    io.stdout(`${s.bold(loaded.path)}: conformant (every declared pair meets its threshold in every mode)\n`);
  } else {
    const n = r.diagnostics.length;
    io.stdout(`${s.bold(loaded.path)}: ${s.yellow("not conformant")} (${n} finding${n === 1 ? "" : "s"}; the theme is still valid)\n`);
    io.stdout(formatDiagnostics(r.diagnostics, s));
    for (const d of r.diagnostics) if (typeof d.params.detail === "string") io.stdout(`  pair ${d.params.detail}\n`);
  }
  return status;
}
