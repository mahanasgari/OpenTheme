/**
 * `opentheme export` and `opentheme import` (specs/005-design-tokens-interchange; chapter 16): the
 * W3C Design Tokens format through `@opentheme/dtcg`.
 */
import { basename, dirname, join } from "node:path";
import { exportTheme, importTokens, type Mode, type ReportEntry } from "@opentheme/dtcg";
import { INPUT_OPTIONS, parse } from "../args.js";
import { colored, formatDiagnostics, plain, type Styler, toJson, withText } from "../format.js";
import { type Io, readInput, UsageError, useColor, writeOutput } from "../io.js";
import { loadTheme } from "../theme.js";

const EXPORT_HELP = `Usage: opentheme export <theme> [options]

Writes one W3C Design Tokens (2025.10) file per mode with the theme's computed values; a derived
token keeps its derivation under $extensions["org.opentheme"].derive.

  --mode <scheme>[:<contrast>]   A mode to export, such as dark or light:high (repeatable;
                                 default: each supported scheme at standard contrast)
  --out-dir <dir>                Where to write (default: the theme's directory)
  --force                        Overwrite existing files
  --trusted --source --base --host --relaxed-gate   --json --no-color
`;

const IMPORT_HELP = `Usage: opentheme import <tokens.json> --out <theme.json> [options]

Creates an OpenTheme theme from a W3C Design Tokens (2025.10) file. Tokens go under the
"primitive" group; anything OpenTheme cannot represent is left out and reported.

  --out <file>             The theme file to write (required)
  --mapping <file>         JSON mapping seeds and roles to token paths, for example
                           {"seed.light.background": "brand.paper", "color.text.primary": "brand.ink"}
  --id <id>  --name <name> The theme's identity (default: a new uid. id, "Imported Tokens")
  --restore-derivations    Restore kept derivations instead of computed values
  --force                  Overwrite --out
  --json  --no-color
`;

function reportLines(report: readonly ReportEntry[], s: Styler): string {
  return report.map((e) => `  ${e.action === "left-out" ? s.yellow(e.action) : s.dim(e.action)} ${e.path || "(document)"}: ${e.reason}\n`).join("");
}

function mode(text: string): Mode {
  const [scheme, contrast = "standard"] = text.split(":");
  if ((scheme !== "light" && scheme !== "dark") || (contrast !== "standard" && contrast !== "high")) {
    throw new UsageError(`--mode must be light or dark, optionally with :standard or :high (got "${text}")`);
  }
  return { scheme, contrast };
}

export function exportCommand(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, {
    ...INPUT_OPTIONS,
    mode: { type: "string", multiple: true },
    "out-dir": { type: "string" },
    force: { type: "boolean" },
  });
  if (values.help) {
    io.stdout(EXPORT_HELP);
    return 0;
  }
  const modes = Array.isArray(values.mode) ? values.mode.map(mode) : undefined;
  const loaded = loadTheme("export", values, positionals, io);
  if (typeof loaded === "number") return loaded;
  const r = exportTheme(loaded.core, loaded.entry, modes ? { modes } : {});
  if (!r.ok) throw new UsageError(`${r.error.kind}: ${r.error.message}`);
  const dir = typeof values["out-dir"] === "string" ? values["out-dir"] : dirname(loaded.path);
  const base = basename(loaded.path).replace(/(\.opentheme)?\.json$/, "");
  const files: string[] = [];
  for (const d of r.documents) {
    const file = join(dir, `${base}.${d.mode.scheme}${d.mode.contrast === "high" ? "-high" : ""}.tokens.json`);
    writeOutput(file, `${JSON.stringify(d.document, null, 2)}\n`, values.force === true);
    files.push(file);
  }
  if (values.json) {
    io.stdout(toJson({ command: "export", path: loaded.path, files, report: r.report, status: 0 }));
    return 0;
  }
  for (const f of files) io.stdout(`${loaded.path}: wrote ${f}\n`);
  if (r.report.length > 0) io.stdout(`report (${r.report.length}):\n${reportLines(r.report, loaded.styler)}`);
  return 0;
}

export function importCommand(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, {
    out: { type: "string" },
    mapping: { type: "string" },
    id: { type: "string" },
    name: { type: "string" },
    "restore-derivations": { type: "boolean" },
    force: { type: "boolean" },
  });
  if (values.help) {
    io.stdout(IMPORT_HELP);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError("import needs exactly one tokens file");
  if (typeof values.out !== "string") throw new UsageError("import needs --out <theme.json>");
  let mapping: Record<string, string> | undefined;
  if (typeof values.mapping === "string") {
    let m: unknown;
    try {
      m = JSON.parse(new TextDecoder().decode(readInput(values.mapping)));
    } catch {
      throw new UsageError(`${values.mapping}: the mapping is not JSON`);
    }
    if (!m || typeof m !== "object" || Array.isArray(m) || !Object.values(m).every((v) => typeof v === "string")) {
      throw new UsageError(`${values.mapping}: the mapping must be an object of token paths`);
    }
    mapping = m as Record<string, string>;
  }
  const path = positionals[0]!;
  const r = importTokens(readInput(path), {
    ...(mapping ? { mapping } : {}),
    ...(typeof values.id === "string" ? { id: values.id } : {}),
    ...(typeof values.name === "string" ? { name: values.name } : {}),
    restoreDerivations: values["restore-derivations"] === true,
  });
  const status = r.text === null ? 1 : 0;
  if (r.text !== null) writeOutput(values.out, r.text, values.force === true);
  if (values.json) {
    io.stdout(
      toJson({
        command: "import",
        path,
        ...(r.text !== null ? { output: values.out, id: (r.theme as { id: string }).id } : {}),
        report: r.report,
        diagnostics: r.diagnostics.map(withText),
        status,
      }),
    );
    return status;
  }
  const s = useColor(io, values["no-color"] === true) ? colored : plain;
  io.stdout(r.text !== null ? `${path}: wrote ${values.out}\n` : `${path}: ${s.red("not imported")}\n`);
  if (r.report.length > 0) io.stdout(`report (${r.report.length}):\n${reportLines(r.report, s)}`);
  io.stdout(formatDiagnostics(r.diagnostics, s));
  return status;
}
