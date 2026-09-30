/**
 * Loading and resolving one theme, shared by resolve, report, css, and preview (research LR2,
 * LR4). A theme that is not valid is reported as `validate` reports it, and the command stops.
 */
import { type ControllerContext, type Core, type Diagnostic, PRESETS, type RegistryEntry, type ResolutionResult } from "@opentheme/core";
import { type Admitted, admit, admitContext, openCore } from "./admit.js";
import { type InputOptions, inputOptions, type Values } from "./args.js";
import { colored, counts, formatDiagnostics, plain, type Styler, toJson, withText } from "./format.js";
import { type Io, readInput, UsageError, useColor } from "./io.js";

export interface Loaded {
  readonly core: Core;
  readonly path: string;
  readonly entry: RegistryEntry;
  readonly options: InputOptions;
  readonly styler: Styler;
}

/** Load the single theme a command works on, or print why it cannot be used (exit status 1). */
export function loadTheme(command: string, values: Values, positionals: readonly string[], io: Io): Loaded | number {
  if (positionals.length !== 1) throw new UsageError(`${command} needs exactly one theme file`);
  const options = inputOptions(values);
  const styler = useColor(io, values["no-color"] === true) ? colored : plain;
  const core = openCore(options);
  const context = admitContext(core, options);
  const path = positionals[0]!;
  const admitted = admit(core, path, readInput(path), "theme", options);
  const failed = [...context, admitted].filter((a) => a.validity !== "valid");
  if (failed.length === 0 && admitted.entry) {
    // On standard error, so it never mixes with CSS, JSON, or other output.
    if (options.relaxedGate) io.stderr(styler.yellow("note: the accessibility gate is relaxed for untrusted themes (--relaxed-gate)\n"));
    return { core, path, entry: admitted.entry, options, styler };
  }
  printAdmissionFailures(command, failed, values.json === true, options.relaxedGate, io, styler);
  return 1;
}

function printAdmissionFailures(command: string, failed: readonly Admitted[], json: boolean, relaxed: boolean, io: Io, s: Styler): void {
  if (json) {
    io.stdout(
      toJson({
        command,
        ...(relaxed ? { gate: "relaxed" } : {}),
        results: failed.map((a) => ({
          path: a.path,
          kind: a.kind,
          validity: a.validity,
          diagnostics: a.diagnostics.map(withText),
          ...(a.error ? { error: { kind: a.error.kind, message: a.error.message, hint: a.error.hint } } : {}),
        })),
        status: 1,
      }),
    );
    return;
  }
  for (const a of failed) {
    const detail = counts(a.diagnostics);
    io.stdout(`${s.bold(a.path)}: ${s.red(a.validity)}${detail ? ` (${detail})` : ""}\n`);
    if (a.error) io.stdout(`  ${s.red(a.error.kind)}: ${a.error.message}\n        ${s.dim(`hint: ${a.error.hint}`)}\n`);
    io.stdout(formatDiagnostics(a.diagnostics, s));
  }
}

export interface Resolved {
  readonly result: Extract<ResolutionResult, { ok: true }>;
  /** Present when the author's theme was not the one applied (research LR4). */
  readonly fallback: string | null;
}

/**
 * Resolve the loaded theme. The policy makes exactly this theme available and the developer
 * default, so the author sees their own theme. With a preset, the preset's permitted points and
 * floors apply: a preset alone makes only trusted entries available, which would hide an
 * untrusted author's theme behind the baseline.
 */
export function resolveTheme(
  loaded: Loaded,
  context: ControllerContext,
  preferences: Readonly<Record<string, unknown>> = {},
  preset?: "closed" | "common-personalization",
): Resolved {
  const { entry, core } = loaded;
  const policy = { ...(preset ? PRESETS[preset] : {}), availableThemes: [entry.id], defaultTheme: entry.id };
  const result = core.resolve(core.registry.snapshot(), {
    selection: { id: entry.id, ...(entry.version ? { version: entry.version } : {}) },
    previous: null,
    preferences,
    ...context,
    policy,
  });
  if (!result.ok) throw new UsageError(`${result.error.kind}: ${result.error.message}`);
  const applied = result.resolved.applied as { id: string; version: string; fallback: string };
  const fallback = applied.fallback !== "none" || applied.id !== entry.id ? `${applied.id}@${applied.version} (${applied.fallback})` : null;
  return { result, fallback };
}

export function fallbackNotice(r: Resolved, s: Styler): string {
  return r.fallback ? s.red(`notice: your theme was not applied; resolution fell back to ${r.fallback}\n`) : "";
}

export function diagnosticsBlock(diagnostics: readonly Diagnostic[], s: Styler): string {
  return diagnostics.length === 0 ? "" : `diagnostics (${counts(diagnostics)}):\n${formatDiagnostics(diagnostics, s)}`;
}
