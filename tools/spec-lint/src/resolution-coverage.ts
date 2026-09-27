/**
 * Resolution fixture coverage (FR-058, SC-009 automated part).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function listIds(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) continue;
    if (!name.endsWith(".json")) continue;
    out.push(`${prefix}/${name.replace(/\.json$/, "")}`);
  }
  return out;
}

const LAYER_PAIRS = [
  "L1-L3",
  "L1-L4",
  "L1-L5",
  "L2-L3",
  "L2-L4",
  "L2-L5",
  "L3-L4",
  "L3-L5",
  "L4-L5",
  "L1-L2",
];
const DIMENSIONS = [
  "colorScheme",
  "contrast",
  "density",
  "motion",
  "sizeClass",
];

export function checkResolutionCoverage(repoRoot: string): string[] {
  const errors: string[] = [];
  const matrixDir = join(
    repoRoot,
    "conformance/fixtures/resolution/matrix",
  );
  const matrix = listIds(matrixDir, "resolution/matrix");
  for (const pair of LAYER_PAIRS) {
    for (const dim of DIMENSIONS) {
      const id = `resolution/matrix/${pair}-${dim}`;
      if (!matrix.includes(id) && !existsSync(join(matrixDir, `${pair}-${dim}.json`))) {
        errors.push(`missing matrix fixture ${pair}-${dim}`);
      }
    }
  }

  const requiredPrefixes = [
    "resolution/us3/",
    "resolution/us4/",
    "resolution/core/",
  ];
  for (const prefix of requiredPrefixes) {
    const dir = join(repoRoot, "conformance/fixtures", prefix);
    if (!existsSync(dir) || readdirSync(dir).length === 0) {
      errors.push(`missing resolution fixtures under ${prefix}`);
    }
  }

  // Text-scale cases (FR-020)
  for (const name of [
    "text-scale",
    "text-scale-clamp",
    "text-scale-platform",
  ]) {
    const p = join(
      repoRoot,
      "conformance/fixtures/resolution/us4",
      `${name}.json`,
    );
    if (!existsSync(p)) errors.push(`missing FR-020 fixture us4/${name}`);
  }

  return errors;
}
