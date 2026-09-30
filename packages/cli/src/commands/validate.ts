/**
 * `opentheme validate <file...>` (US1; FR-T020, FR-T021): each file's validity and Core's
 * diagnostics. Hosts and bases given with --host and --base are validated and reported first.
 */
import { INPUT_OPTIONS, inputOptions, parse } from "../args.js";
import { type Admitted, admit, admitContext, kindOf, openCore } from "../admit.js";
import { clean, colored, counts, formatDiagnostics, plain, toJson, withText } from "../format.js";
import { InputOutputError, type Io, readInput, UsageError, useColor } from "../io.js";

const HELP = `Usage: opentheme validate <file...> [options]

Validates themes and host declarations (a file with "openthemeHost" is a host).

  --trusted            Admit the files as trusted (only your own bundled themes)
  --source <source>    Source of untrusted files: user-created (default), imported, shared, ai-generated
  --base <file>        A base theme for inheritance (repeatable)
  --host <file>        A host declaration to validate themes against
  --relaxed-gate       Admit untrusted themes that miss the accessibility gate
  --json               One JSON document
  --no-color           No color
`;

type Row = Admitted | { readonly path: string; readonly failure: string };

export function validate(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, INPUT_OPTIONS);
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (positionals.length === 0) throw new UsageError("validate needs at least one file");
  const options = inputOptions(values);
  const core = openCore(options);
  const rows: Row[] = [...admitContext(core, options)];
  for (const path of positionals) {
    try {
      const bytes = readInput(path);
      rows.push(admit(core, path, bytes, kindOf(bytes), options));
    } catch (e) {
      if (!(e instanceof InputOutputError)) throw e;
      rows.push({ path, failure: e.message });
    }
  }
  const status = rows.some((r) => "failure" in r) ? 3 : rows.some((r) => !("failure" in r) && r.validity !== "valid") ? 1 : 0;

  if (values.json) {
    const results = rows.map((r) =>
      "failure" in r
        ? { path: r.path, failure: r.failure }
        : {
            path: r.path,
            kind: r.kind,
            validity: r.validity,
            diagnostics: r.diagnostics.map(withText),
            ...(r.error ? { error: { kind: r.error.kind, message: r.error.message, hint: r.error.hint } } : {}),
          },
    );
    io.stdout(toJson({ command: "validate", ...(options.relaxedGate ? { gate: "relaxed" } : {}), results, status }));
    return status;
  }

  const s = useColor(io, values["no-color"] === true) ? colored : plain;
  if (options.relaxedGate) io.stdout(s.yellow("note: the accessibility gate is relaxed for untrusted themes (--relaxed-gate)\n"));
  for (const r of rows) {
    if ("failure" in r) {
      io.stdout(`${s.bold(clean(r.path))}: ${s.red("unreadable")}: ${clean(r.failure.slice(r.path.length + 2))}\n`);
      continue;
    }
    const detail = counts(r.diagnostics);
    const label = r.validity === "valid" ? "valid" : s.red(r.validity);
    io.stdout(`${s.bold(clean(r.path))}${r.kind === "host" ? " (host)" : ""}: ${label}${detail ? ` (${detail})` : ""}\n`);
    if (r.error) io.stdout(`  ${s.red(r.error.kind)}: ${r.error.message}\n        ${s.dim(`hint: ${r.error.hint}`)}\n`);
    io.stdout(formatDiagnostics(r.diagnostics, s));
  }
  const ok = rows.filter((r) => !("failure" in r) && r.validity === "valid").length;
  io.stdout(`${rows.length} file${rows.length === 1 ? "" : "s"}: ${ok} valid, ${rows.length - ok} not valid\n`);
  return status;
}
