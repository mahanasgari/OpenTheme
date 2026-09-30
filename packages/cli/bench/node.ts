/**
 * `bench:cli` (research LR10; SC-T003; T031): wall time of `opentheme validate`, including Node
 * start-up, for the typical theme (≤ 1 s) and the specification's at-limit theme (≤ 3 s), as
 * medians. Report-only in CI, like the other benchmarks.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { atLimitTheme } from "../../core/bench/cases.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const bin = join(root, "packages/cli/dist/main.js");
const dir = mkdtempSync(join(tmpdir(), "opentheme-bench-"));
const atLimit = join(dir, "at-limit.json");
writeFileSync(atLimit, JSON.stringify(atLimitTheme()));

function median(file: string, runs: number): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, [bin, "validate", "--trusted", file], { encoding: "utf8" });
    samples.push(performance.now() - t0);
    if (r.status !== 0) throw new Error(`validate ${file} exited ${r.status}: ${r.stdout}${r.stderr}`);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}

const results = [
  { name: "typical", ms: median(join(root, "tools/bench/fixtures/typical.opentheme.json"), 9), budget: 1000 },
  { name: "at-limit", ms: median(atLimit, 5), budget: 3000 },
];
rmSync(dir, { recursive: true, force: true });
let over = false;
for (const r of results) {
  process.stderr.write(`bench:cli validate ${r.name} median=${r.ms.toFixed(0)}ms budget=${r.budget}ms\n`);
  over ||= r.ms > r.budget;
}
if (over) {
  process.stderr.write("bench:cli FAIL\n");
  process.exit(1);
}
process.stderr.write("bench:cli ok\n");
