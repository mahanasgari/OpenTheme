#!/usr/bin/env node
/**
 * ot-conformance — OpenTheme conformance suite runner.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverFixtures, repoRoot, type FixtureFile } from "./fixtures.js";
import { expandGenerate, type GenerateSpec } from "./generate.js";
import { connectImpl } from "./protocol.js";
import {
  compareKernels,
  compareResolved,
  compareValidate,
  compareVersionsResult,
  compareMigrateResult,
  compareCanonicalizeResult,
  compareFlattenResult,
  compareExportCheckResult,
  type DiagnosticLike,
  comparePreferencesResult,
} from "./compare.js";
import { printSummary, writeReports, type FixtureOutcome } from "./report.js";
import { runSeedSweep } from "./sweeps/seeds.js";
import { runOfficialThemeSweep } from "./sweeps/official.js";
import { runAccentSweep } from "./sweeps/accents.js";
import {
  checkDiagnosticQuality,
  registryPath,
} from "./checks/diagnostic-quality.js";
import { runRoundTripCheck } from "./checks/round-trip.js";
import { comparingImpl, inProcessImpl, protocolImpl } from "./sweeps/impl.js";
import { crosscheckRequest } from "./crosscheck.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultImpl = resolve(
  here,
  "../../../tools/reference-checker/dist/cli/main.js",
);

function printHelp(): void {
  process.stdout.write(
    [
      "ot-conformance — OpenTheme conformance runner",
      "",
      "Usage:",
      "  ot-conformance [--impl <command>] [--filter <glob>] [--verbose] [--report <dir>]",
      "  ot-conformance --sweeps [--impl <command>]",
      "  ot-conformance [--sweeps] --impl <command> --compare-impl <command>   (byte cross-check)",
      "  ot-conformance --help",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): {
  impl: string;
  filter?: string;
  verbose: boolean;
  report: string;
  sweeps: boolean;
  implExplicit: boolean;
  compareImpl?: string;
} {
  let impl = `node ${defaultImpl} serve-conformance`;
  let filter: string | undefined;
  let verbose = false;
  let report = join(repoRoot, "conformance/out");
  let sweeps = false;
  let implExplicit = false;
  let compareImpl: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--impl") {
      const value = argv[++i];
      if (!value) {
        process.stderr.write("--impl requires a command\n");
        process.exit(3);
      }
      impl = value;
      implExplicit = true;
    } else if (arg === "--filter") {
      const value = argv[++i];
      if (!value) {
        process.stderr.write("--filter requires a pattern\n");
        process.exit(3);
      }
      filter = value;
    } else if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--report") {
      const value = argv[++i];
      if (!value) {
        process.stderr.write("--report requires a path\n");
        process.exit(3);
      }
      report = value;
    } else if (arg === "--compare-impl") {
      const value = argv[++i];
      if (!value) {
        process.stderr.write("--compare-impl requires a command\n");
        process.exit(3);
      }
      compareImpl = value;
    } else if (arg === "--sweeps") {
      sweeps = true;
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printHelp();
      process.exit(3);
    }
  }
  const out: {
    impl: string;
    filter?: string;
    verbose: boolean;
    report: string;
    sweeps: boolean;
    implExplicit: boolean;
    compareImpl?: string;
  } = { impl, verbose, report, sweeps, implExplicit, ...(compareImpl ? { compareImpl } : {}) };
  if (filter !== undefined) out.filter = filter;
  return out;
}

const ALLOWED_FILE_PREFIXES = [
  "conformance/fixtures/",
  "specification/themes/",
  "specification/hosts/",
  "specification/examples/",
];

function resolveFileRef(ref: string): unknown {
  const normalized = ref.replace(/\\/g, "/");
  if (!ALLOWED_FILE_PREFIXES.some((p) => normalized.startsWith(p))) {
    throw new Error(`$file path not allowed: ${ref}`);
  }
  const full = join(repoRoot, normalized);
  return JSON.parse(readFileSync(full, "utf8"));
}

function expandValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(expandValue);
  const obj = value as Record<string, unknown>;
  if (typeof obj.$file === "string") {
    return resolveFileRef(obj.$file);
  }
  if (obj.generate && typeof obj.generate === "object") {
    return expandGenerate(obj.generate as GenerateSpec);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = expandValue(v);
  }
  return out;
}

function buildRequestInput(fixture: FixtureFile): unknown {
  const expanded = expandValue(fixture.input);
  if (fixture.kind === "kernel") {
    // Send the input vectors (never the expected outputs), so implementations need no access
    // to the conformance files.
    const vectors = (fixture.expect.vectors as Array<[string, string, string]> | undefined) ?? [];
    return {
      ...(expanded as Record<string, unknown>),
      vectors: vectors.map(([fn, inputHex]) => [fn, inputHex]),
    };
  }
  if (fixture.kind === "validate" || fixture.kind === "accessibility-report") {
    const input = expanded as Record<string, unknown>;
    // Normalize: theme may be the whole input or under .theme
    if (input.theme === undefined && input.opentheme !== undefined) {
      return { theme: input };
    }
    return input;
  }
  if (fixture.kind === "validate-host") {
    const input = expanded as Record<string, unknown>;
    if (input.host === undefined && input.openthemeHost !== undefined) {
      return { host: input };
    }
    return input;
  }
  if (fixture.kind === "resolve") {
    return expanded;
  }
  return expanded;
}

async function runFixture(
  client: Awaited<ReturnType<typeof connectImpl>>,
  fixture: FixtureFile,
  verbose: boolean,
): Promise<FixtureOutcome> {
  try {
    const input = buildRequestInput(fixture);
    const response = await client.request(fixture.id, fixture.kind, input);

    if (response.unsupported) {
      return { id: fixture.id, status: "unsupported" };
    }

    const result = response.result as Record<string, unknown> | undefined;
    if (!result) {
      return {
        id: fixture.id,
        status: "error",
        message: "empty result",
      };
    }

    if (verbose) {
      process.stderr.write(
        `--- ${fixture.id} ---\nexpected: ${JSON.stringify(fixture.expect).slice(0, 200)}\n`,
      );
    }

    let compare;
    if (fixture.kind === "validate" || fixture.kind === "validate-host" || fixture.kind === "accessibility-report") {
      compare = compareValidate(
        fixture.expect as {
          validity?: string;
          diagnostics?: DiagnosticLike[];
        },
        result as {
          validity?: string;
          diagnostics?: DiagnosticLike[];
        },
      );
    } else if (fixture.kind === "resolve") {
      compare = compareResolved(
        fixture.expect as {
          resolved?: unknown;
          subset?: boolean;
          diagnostics?: DiagnosticLike[];
        },
        result as {
          resolved?: unknown;
          diagnostics?: DiagnosticLike[];
        },
      );
    } else if (fixture.kind === "kernel") {
      compare = compareKernels(
        (fixture.expect.vectors as Array<[string, string, string]>) ?? [],
        (result.vectors as Array<[string, string, string]>) ?? [],
      );
    } else if (fixture.kind === "compare-versions") {
      compare = compareVersionsResult(
        fixture.expect as {
          classification?: string;
          reasons?: Array<{ kind?: string; detail?: string }>;
        },
        result as {
          classification?: string;
          reasons?: Array<{ kind?: string; detail?: string }>;
        },
      );
    } else if (fixture.kind === "migrate") {
      compare = compareMigrateResult(
        fixture.expect as {
          migrated?: boolean;
          diagnostics?: DiagnosticLike[];
          document?: { opentheme?: string };
        },
        result as {
          migrated?: boolean;
          diagnostics?: DiagnosticLike[];
          document?: { opentheme?: string };
        },
      );
    } else if (fixture.kind === "canonicalize") {
      compare = compareCanonicalizeResult(
        fixture.expect as { canonical?: string; integrity?: string },
        result as { canonical?: string; integrity?: string },
      );
    } else if (fixture.kind === "flatten") {
      compare = compareFlattenResult(
        fixture.expect as {
          document?: unknown;
          lineage?: unknown;
          diagnostics?: DiagnosticLike[];
          ok?: boolean;
        },
        result as {
          document?: unknown;
          lineage?: unknown;
          diagnostics?: DiagnosticLike[];
          ok?: boolean;
        },
      );
    } else if (fixture.kind === "export-check") {
      compare = compareExportCheckResult(
        fixture.expect as {
          eligible?: boolean;
          diagnostics?: DiagnosticLike[];
        },
        result as {
          eligible?: boolean;
          diagnostics?: DiagnosticLike[];
        },
      );
    } else if (fixture.kind === "validate-preferences") {
      compare = comparePreferencesResult(
        fixture.expect as { usable?: boolean; values?: unknown; diagnostics?: DiagnosticLike[] },
        result as { usable?: boolean; values?: unknown; diagnostics?: DiagnosticLike[] },
      );
    } else {
      return {
        id: fixture.id,
        status: "unsupported",
        message: `kind ${fixture.kind} not compared yet`,
      };
    }

    if (compare.ok) {
      return { id: fixture.id, status: "pass" };
    }
    return { id: fixture.id, status: "fail", failures: compare.failures };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("timeout")) {
      return { id: fixture.id, status: "timeout", message: msg };
    }
    return { id: fixture.id, status: "error", message: msg };
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.compareImpl && !options.sweeps) {
    const a = await connectImpl(options.impl);
    const b = await connectImpl(options.compareImpl);
    process.stderr.write(`crosscheck: ${a.implementation} vs ${b.implementation}\n`);
    const fixtures = discoverFixtures(options.filter);
    let differences = 0;
    for (const fixture of fixtures) {
      const diff = await crosscheckRequest(a, b, fixture.id, fixture.kind, buildRequestInput(fixture));
      if (diff) {
        differences += 1;
        process.stderr.write(`DIFF ${fixture.id} ${diff}\n`);
      }
    }
    await a.close();
    await b.close();
    process.stderr.write(`crosscheck: ${fixtures.length} fixtures, ${differences} differences\n`);
    process.exit(differences === 0 ? 0 : 1);
  }

  if (options.sweeps) {
    // Default: in-process reference checker. With --impl: every request goes over the protocol.
    const sweepClient = options.implExplicit ? await connectImpl(options.impl) : undefined;
    const compareClient = options.compareImpl ? await connectImpl(options.compareImpl) : undefined;
    const primary = sweepClient ? protocolImpl(sweepClient) : inProcessImpl();
    const impl = compareClient ? comparingImpl(primary, protocolImpl(compareClient)) : primary;
    process.stderr.write(`ot-conformance: sweeps impl=${impl.label}\n`);
    const exitSweeps = async (code: number): Promise<never> => {
      if (sweepClient) await sweepClient.close();
      if (compareClient) await compareClient.close();
      const diffs = "differences" in impl ? (impl as { differences: string[] }).differences : [];
      if (compareClient) {
        for (const d of diffs.slice(0, 20)) process.stderr.write(`DIFF ${d}\n`);
        const dump = process.env.OT_CROSSCHECK_DUMP;
        if (dump && diffs.length > 0) {
          const inputs = (impl as { inputs?: unknown[] }).inputs ?? [];
          writeFileSync(dump, inputs.map((i) => JSON.stringify(i)).join("\n") + "\n");
          process.stderr.write(`crosscheck sweeps: differing inputs written to ${dump}\n`);
        }
        process.stderr.write(`crosscheck sweeps: ${diffs.length} differences\n`);
        if (diffs.length > 0 && code === 0) process.exit(1);
      }
      process.exit(code);
    };
    process.stderr.write("ot-conformance: running SC-015 seed sweep…\n");
    const result = await runSeedSweep(impl);
    process.stderr.write(
      `seeds: ${result.combinations} combinations, ${result.resolutions} resolutions\n`,
    );
    if (result.failures.length > 0) {
      for (const f of result.failures.slice(0, 20)) {
        process.stderr.write(`  FAIL ${f}\n`);
      }
      if (result.failures.length > 20) {
        process.stderr.write(
          `  … and ${result.failures.length - 20} more\n`,
        );
      }
      await exitSweeps(1);
    }
    process.stderr.write("seeds: ok\n");

    process.stderr.write("ot-conformance: running SC-006 official theme sweep…\n");
    const official = await runOfficialThemeSweep(impl);
    process.stderr.write(
      `official: ${official.themes} themes, ${official.resolutions} resolutions\n`,
    );
    if (official.failures.length > 0) {
      for (const f of official.failures.slice(0, 20)) {
        process.stderr.write(`  FAIL ${f}\n`);
      }
      await exitSweeps(1);
    }
    process.stderr.write("official: ok\n");

    process.stderr.write("ot-conformance: running SC-014 accent sweep…\n");
    const accents = await runAccentSweep(impl);
    process.stderr.write(
      `accents: ${accents.accents} accents, ${accents.resolutions} resolutions\n`,
    );
    if (accents.failures.length > 0) {
      for (const f of accents.failures.slice(0, 20)) {
        process.stderr.write(`  FAIL ${f}\n`);
      }
      if (accents.failures.length > 20) {
        process.stderr.write(
          `  … and ${accents.failures.length - 20} more\n`,
        );
      }
      await exitSweeps(1);
    }
    process.stderr.write("accents: ok\n");

    process.stderr.write("ot-conformance: running host coverage (SC-002)…\n");
    const { runHostCoverage } = await import("./checks/host-coverage.js");
    const coverage = await runHostCoverage(impl);
    process.stderr.write(`host-coverage: ${coverage.pairs} pairs\n`);
    if (coverage.failures.length > 0) {
      for (const f of coverage.failures.slice(0, 20)) {
        process.stderr.write(`  FAIL ${f}\n`);
      }
      await exitSweeps(1);
    }
    process.stderr.write("host-coverage: ok\n");
    await exitSweeps(0);
  }

  const fixtures = discoverFixtures(options.filter);
  process.stderr.write(
    `ot-conformance: ${fixtures.length} fixtures, impl=${options.impl}\n`,
  );

  const client = await connectImpl(options.impl);
  process.stderr.write(
    `handshake: ${client.implementation}@${client.version} supports=[${client.supports.join(",")}]\n`,
  );

  const outcomes: FixtureOutcome[] = [];
  for (const fixture of fixtures) {
    const outcome = await runFixture(client, fixture, options.verbose);
    outcomes.push(outcome);
    const mark =
      outcome.status === "pass"
        ? "PASS"
        : outcome.status === "unsupported"
          ? "SKIP"
          : "FAIL";
    process.stderr.write(`${mark} ${fixture.id}\n`);
  }

  writeReports(options.report, outcomes);

  // SC-005 automated part: invalid/malicious fixture diagnostics must be registered.
  const qualityFailures: string[] = [];
  for (const fixture of fixtures) {
    if (
      !fixture.id.startsWith("invalid/") &&
      !fixture.id.startsWith("malicious/")
    ) {
      continue;
    }
    const expectDiags =
      (fixture.expect.diagnostics as DiagnosticLike[] | undefined) ?? [];
    const q = checkDiagnosticQuality(expectDiags, registryPath(repoRoot));
    for (const f of q) qualityFailures.push(`${fixture.id}: ${f}`);
  }
  if (qualityFailures.length > 0) {
    process.stderr.write("diagnostic-quality failures:\n");
    for (const f of qualityFailures.slice(0, 20)) {
      process.stderr.write(`  ${f}\n`);
    }
    process.exit(1);
  }

  printSummary(outcomes);

  process.stderr.write("ot-conformance: round-trip check (SC-011)…\n");
  const roundTrip = await runRoundTripCheck(protocolImpl(client));
  await client.close();
  process.stderr.write(`round-trip: ${roundTrip.checked} themes\n`);
  if (roundTrip.failures.length > 0) {
    for (const f of roundTrip.failures.slice(0, 20)) {
      process.stderr.write(`  FAIL ${f}\n`);
    }
    process.exit(1);
  }
  process.stderr.write("round-trip: ok\n");

  const failed = outcomes.some(
    (o) =>
      o.status === "fail" || o.status === "timeout" || o.status === "error",
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err: unknown) => {
  process.stderr.write(`ot-conformance: ${(err as Error).message}\n`);
  process.exit(4);
});
