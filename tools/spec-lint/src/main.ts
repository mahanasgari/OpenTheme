#!/usr/bin/env node
/**
 * Spec-lint: schemas, registries, consistency, examples, traceability, markdown.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkGeneratedTypesFresh } from "./freshness.js";
import { checkSchemas } from "./schemas.js";
import { checkRegistries } from "./registries.js";
import { checkConsistency } from "./consistency.js";
import { checkExamples } from "./examples.js";
import { checkTraceability } from "./traceability.js";
import { checkMarkdown } from "./markdown.js";
import { checkOfficialThemes } from "./official-themes.js";
import { scanCapabilitySchemas } from "./capability-scan.js";
import { checkCompatFreeze } from "./compat-freeze.js";
import { checkMachineReadability } from "./machine-readability.js";
import { checkResolutionCoverage } from "./resolution-coverage.js";
import { checkDomainTerms } from "./domain-terms.js";
import { checkResolutionInputs } from "./resolution-inputs.js";
import { checkCoreFreshness } from "./core-freshness.js";
import { checkCoreBoundaries } from "./core-boundaries.js";
import { checkWebBoundaries } from "./web-boundaries.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

async function main(): Promise<void> {
  const errors: string[] = [];

  errors.push(...(await checkGeneratedTypesFresh(repoRoot)));
  errors.push(...checkSchemas(repoRoot));
  errors.push(...checkCoreFreshness(repoRoot));
  errors.push(...checkCoreBoundaries(repoRoot));
  errors.push(...checkWebBoundaries(repoRoot));
  errors.push(...checkRegistries(repoRoot));
  errors.push(...checkConsistency(repoRoot));
  errors.push(...checkExamples(repoRoot));
  errors.push(...checkTraceability(repoRoot).map((e) => `traceability: ${e}`));
  errors.push(
    ...checkResolutionCoverage(repoRoot).map((e) => `resolution-coverage: ${e}`),
  );
  errors.push(
    ...checkResolutionInputs(repoRoot).map((e) => `resolution-inputs: ${e}`),
  );
  errors.push(...checkDomainTerms(repoRoot).map((e) => `domain-terms: ${e}`));
  errors.push(...checkOfficialThemes(repoRoot));

  const mr = checkMachineReadability(repoRoot);
  errors.push(...mr.hard.map((e) => `machine-readability: ${e}`));
  // Schema property/examples annotation is incomplete in draft; report but do not
  // block until bulk annotation lands (same posture as capability-scan).
  if (mr.schemaGaps.length > 0) {
    process.stderr.write(
      `spec-lint machine-readability: ${mr.schemaGaps.length} schema documentation gap(s)\n`,
    );
  }

  const freeze = checkCompatFreeze();
  if (!freeze.ok) errors.push(...freeze.failures);

  const cap = scanCapabilitySchemas(
    path.join(repoRoot, "specification/schemas"),
  );
  // URI formats are hard failures; unconstrained strings are reported but do not
  // block until schemas are fully annotated (allowlist phase).
  for (const issue of cap) {
    if (issue.includes("URI format")) errors.push(issue);
    else process.stderr.write(`spec-lint capability: ${issue}\n`);
  }

  // Markdownlint is advisory during foundation if it returns only style nits;
  // still surface failures.
  const md = checkMarkdown(repoRoot);
  if (md.length > 0) {
    process.stderr.write(
      `spec-lint: markdownlint reported ${md.length} issue group(s)\n`,
    );
    // Do not fail the gate on markdown alone until chapters are cleaned (T084 soft).
    for (const m of md.slice(0, 3)) {
      process.stderr.write(`${m.slice(0, 500)}\n`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`spec-lint: ${error}\n`);
    process.exit(1);
  }
  process.stderr.write("spec-lint: ok\n");
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`spec-lint: ${(err as Error).message}\n`);
  process.exit(1);
});
