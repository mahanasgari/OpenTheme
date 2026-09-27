#!/usr/bin/env node
/**
 * ot-ref — private non-normative OpenTheme reference checker CLI.
 * Exit codes: 0 success, 1 invalid, 2 unsupported, 3 usage, 4 internal.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { validateTheme } from "../validate/document.js";
import { validateHost } from "../validate/host.js";
import { resolveTheme, type ResolveInput } from "../resolve/index.js";
import { migrateTheme, type MigrationManifest } from "../versioning/migrate.js";
import { compareThemes } from "../versioning/compare.js";
import { serveConformance } from "../conformance/serve.js";
import { computeIntegrity } from "../canonical/integrity.js";
import {
  checkExportEligibility,
  flattenTheme,
} from "../canonical/flatten.js";
import type { ThemeWithTrust } from "../validate/inheritance.js";

const EXIT = {
  ok: 0,
  invalid: 1,
  unsupported: 2,
  usage: 3,
  internal: 4,
} as const;

function printHelp(): void {
  process.stderr.write(
    [
      "ot-ref — OpenTheme reference checker (non-normative)",
      "",
      "Usage:",
      "  ot-ref validate <theme> [--base <file>]... [--host <file>] [--json]",
      "  ot-ref validate-host <host> [--json]",
      "  ot-ref resolve <input.json> [--json]",
      "  ot-ref canonicalize <theme> [--json]",
      "  ot-ref flatten <theme> [--base <file>]... [--json]",
      "  ot-ref export-check <theme> [--json]",
      "  ot-ref migrate <theme> --manifest <file> [--profile <name>] [--json]",
      "  ot-ref compare <old> <new> [--json]",
      "  ot-ref serve-conformance",
      "  ot-ref --help",
      "",
    ].join("\n"),
  );
}

function usageError(message: string): never {
  process.stderr.write(`${message}\n`);
  printHelp();
  process.exit(EXIT.usage);
}

function formatHumanDiagnostics(
  diagnostics: Array<{
    code: string;
    severity: string;
    message: string;
    location?: { pointer?: string };
  }>,
): string {
  if (diagnostics.length === 0) return "No diagnostics.\n";
  return diagnostics
    .map((d) => {
      const loc = d.location?.pointer ?? "/";
      return `${d.severity.toUpperCase()} ${d.code} ${loc}: ${d.message}`;
    })
    .join("\n")
    .concat("\n");
}

function cmdValidate(args: string[]): void {
  let json = false;
  const bases: string[] = [];
  let hostPath: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (a === "--json") json = true;
    else if (a === "--base") {
      const next = args[++i];
      if (!next) usageError("--base requires a file path");
      bases.push(next);
    } else if (a === "--host") {
      const next = args[++i];
      if (!next) usageError("--host requires a file path");
      hostPath = next;
    } else if (a.startsWith("-")) usageError(`Unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1) {
    usageError("validate requires exactly one theme path");
  }
  const path = positional[0]!;
  let bytes: string;
  try {
    bytes = readFileSync(path, "utf8");
  } catch (err) {
    process.stderr.write(`Failed to read ${path}: ${(err as Error).message}\n`);
    process.exit(EXIT.internal);
  }

  const baseDocs = bases.map((p) => {
    try {
      return {
        trust: "trusted" as const,
        document: JSON.parse(readFileSync(p, "utf8")) as Record<
          string,
          unknown
        >,
      };
    } catch (err) {
      process.stderr.write(`Failed to read base ${p}: ${(err as Error).message}\n`);
      process.exit(EXIT.internal);
    }
  });

  let host: Record<string, unknown> | null = null;
  if (hostPath) {
    try {
      host = JSON.parse(readFileSync(hostPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch (err) {
      process.stderr.write(
        `Failed to read host ${hostPath}: ${(err as Error).message}\n`,
      );
      process.exit(EXIT.internal);
    }
  }

  try {
    const result = validateTheme(bytes, { bases: baseDocs, host });
    if (json) {
      process.stdout.write(
        JSON.stringify({
          validity: result.valid ? "valid" : "invalid",
          diagnostics: result.diagnostics,
        }) + "\n",
      );
    } else {
      process.stderr.write(
        result.valid ? "valid\n" : "invalid\n",
      );
      process.stderr.write(formatHumanDiagnostics(result.diagnostics));
    }
    process.exit(result.valid ? EXIT.ok : EXIT.invalid);
  } catch (err) {
    process.stderr.write(`Internal error: ${(err as Error).message}\n`);
    process.exit(EXIT.internal);
  }
}

function cmdValidateHost(args: string[]): void {
  let json = false;
  const positional: string[] = [];
  for (const a of args) {
    if (a === "--json") json = true;
    else if (a.startsWith("-")) usageError(`Unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1) {
    usageError("validate-host requires exactly one host path");
  }
  const path = positional[0]!;
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (err) {
    process.stderr.write(`Failed to read ${path}: ${(err as Error).message}\n`);
    process.exit(EXIT.internal);
  }
  const result = validateHost(doc);
  if (json) {
    process.stdout.write(
      JSON.stringify({
        validity: result.valid ? "valid" : "invalid",
        diagnostics: result.diagnostics,
      }) + "\n",
    );
  } else {
    process.stderr.write(result.valid ? "valid\n" : "invalid\n");
    process.stderr.write(formatHumanDiagnostics(result.diagnostics));
  }
  process.exit(result.valid ? EXIT.ok : EXIT.invalid);
}

function cmdResolve(args: string[]): void {
  let json = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (a === "--json") json = true;
    else if (a.startsWith("-")) usageError(`Unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1) {
    usageError("resolve requires exactly one input JSON path");
  }
  const path = positional[0]!;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    process.stderr.write(`Failed to read ${path}: ${(err as Error).message}\n`);
    process.exit(EXIT.internal);
  }

  try {
    const input = JSON.parse(raw) as ResolveInput;
    const { resolved, diagnostics } = resolveTheme(input);
    if (json) {
      process.stdout.write(JSON.stringify({ resolved, diagnostics }) + "\n");
    } else {
      process.stderr.write(
        `resolved ${resolved.applied.id}@${resolved.applied.version} fallback=${resolved.applied.fallback}\n`,
      );
      process.stderr.write(formatHumanDiagnostics(diagnostics));
      process.stdout.write(JSON.stringify(resolved, null, 2) + "\n");
    }
    process.exit(EXIT.ok);
  } catch (err) {
    process.stderr.write(`Internal error: ${(err as Error).message}\n`);
    process.exit(EXIT.internal);
  }
}

function cmdMigrate(args: string[]): void {
  let json = false;
  let manifestPath: string | undefined;
  let profile: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (a === "--json") json = true;
    else if (a === "--manifest") {
      const next = args[++i];
      if (!next) usageError("--manifest requires a file path");
      manifestPath = next;
    } else if (a === "--profile") {
      const next = args[++i];
      if (!next) usageError("--profile requires a name");
      profile = next;
    } else if (a.startsWith("-")) usageError(`Unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1 || !manifestPath) {
    usageError("migrate requires <theme> and --manifest <file>");
  }
  const theme = JSON.parse(readFileSync(positional[0]!, "utf8")) as Record<
    string,
    unknown
  >;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MigrationManifest;
  const result = migrateTheme(
    theme,
    manifest,
    profile !== undefined ? { profile } : {},
  );
  if (json) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    process.stderr.write(
      result.migrated ? `migrated → ${String(result.document.opentheme)}\n` : "not migrated\n",
    );
    process.stderr.write(formatHumanDiagnostics(result.diagnostics));
    process.stdout.write(JSON.stringify(result.document, null, 2) + "\n");
  }
  process.exit(EXIT.ok);
}

function cmdCompare(args: string[]): void {
  let json = false;
  const positional: string[] = [];
  for (const a of args) {
    if (a === "--json") json = true;
    else if (a.startsWith("-")) usageError(`Unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) {
    usageError("compare requires <old> <new>");
  }
  const oldT = JSON.parse(readFileSync(positional[0]!, "utf8")) as Record<
    string,
    unknown
  >;
  const newT = JSON.parse(readFileSync(positional[1]!, "utf8")) as Record<
    string,
    unknown
  >;
  const result = compareThemes(oldT, newT);
  if (json) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    process.stderr.write(`${result.classification}\n`);
    for (const r of result.reasons) {
      process.stderr.write(`  ${r.kind}: ${r.detail}\n`);
    }
  }
  process.exit(EXIT.ok);
}

function readThemeArgs(args: string[]): {
  json: boolean;
  path: string;
  bases: ThemeWithTrust[];
} {
  let json = false;
  const bases: string[] = [];
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (a === "--json") json = true;
    else if (a === "--base") {
      const next = args[++i];
      if (!next) usageError("--base requires a file path");
      bases.push(next);
    } else if (a.startsWith("-")) usageError(`Unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1) {
    usageError("command requires exactly one theme path");
  }
  return {
    json,
    path: positional[0]!,
    bases: bases.map((p) => ({
      trust: "trusted" as const,
      document: JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>,
    })),
  };
}

function cmdCanonicalize(args: string[]): void {
  const { json, path } = readThemeArgs(args);
  const theme = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  const { canonical, integrity } = computeIntegrity(theme);
  if (json) {
    process.stdout.write(JSON.stringify({ canonical, integrity }) + "\n");
  } else {
    process.stdout.write(canonical + "\n");
    process.stderr.write(`${integrity}\n`);
  }
  process.exit(EXIT.ok);
}

function cmdFlatten(args: string[]): void {
  const { json, path, bases } = readThemeArgs(args);
  const theme = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  const result = flattenTheme(theme, bases);
  if (json) {
    process.stdout.write(
      JSON.stringify({
        document: result.document,
        diagnostics: result.diagnostics,
        ok: result.ok,
      }) + "\n",
    );
  } else {
    process.stderr.write(result.ok ? "flattened\n" : "flatten failed\n");
    process.stderr.write(formatHumanDiagnostics(result.diagnostics));
    process.stdout.write(JSON.stringify(result.document, null, 2) + "\n");
  }
  process.exit(result.ok ? EXIT.ok : EXIT.invalid);
}

function cmdExportCheck(args: string[]): void {
  const { json, path } = readThemeArgs(args);
  const theme = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  const result = checkExportEligibility(theme);
  if (json) {
    process.stdout.write(
      JSON.stringify({
        eligible: result.eligible,
        diagnostics: result.diagnostics,
      }) + "\n",
    );
  } else {
    process.stderr.write(result.eligible ? "eligible\n" : "not eligible\n");
    process.stderr.write(formatHumanDiagnostics(result.diagnostics));
  }
  process.exit(result.eligible ? EXIT.ok : EXIT.invalid);
}

async function cmdServe(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    await serveConformance(rl, process.stdout);
    process.exit(EXIT.ok);
  } catch (err) {
    process.stderr.write(`Internal error: ${(err as Error).message}\n`);
    process.exit(EXIT.internal);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    process.exit(argv.length === 0 ? EXIT.usage : EXIT.ok);
  }

  const cmd = argv[0];
  const rest = argv.slice(1);

  switch (cmd) {
    case "validate":
      cmdValidate(rest);
      break;
    case "validate-host":
      cmdValidateHost(rest);
      break;
    case "resolve":
      cmdResolve(rest);
      break;
    case "canonicalize":
      cmdCanonicalize(rest);
      break;
    case "flatten":
      cmdFlatten(rest);
      break;
    case "export-check":
      cmdExportCheck(rest);
      break;
    case "migrate":
      cmdMigrate(rest);
      break;
    case "compare":
      cmdCompare(rest);
      break;
    case "serve-conformance":
      await cmdServe();
      break;
    default:
      usageError(`Unknown command: ${cmd}`);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Internal error: ${(err as Error).message}\n`);
  process.exit(EXIT.internal);
});
