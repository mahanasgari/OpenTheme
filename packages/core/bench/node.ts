/**
 * Core benchmarks in Node (research R22; NFR-C001; task T068). The cases are in bench/cases.ts:
 * typical admit + resolve ≤ 25 ms, at-limit ≤ 250 ms, 10 MiB refusal ≤ 5 ms, and re-resolution
 * after a context change ≤ 4 ms (medians).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { runBench } from "./cases.js";
import { runPhases } from "./phases.js";

// Run from bench/ (tsx) or bench/dist/ (the bundle): find the repository root either way.
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, here.endsWith("dist") ? "../../../.." : "../../..");
const results = runBench(
  readFileSync(join(root, "tools/bench/fixtures/typical.opentheme.json"), "utf8"),
  readFileSync(join(root, "specification/themes/reference/org.opentheme.aurora.opentheme.json"), "utf8"),
  () => performance.now(),
);
// The phase breakdown locates engine-specific costs; it is reported, never gated.
for (const p of runPhases(() => performance.now())) {
  process.stderr.write(`bench:core phase ${p.name} median=${p.ms.toFixed(1)}ms\n`);
}
const failures: string[] = [];
for (const r of results) {
  process.stderr.write(`bench:core ${r.name} median=${r.ms.toFixed(2)}ms budget=${r.budget}ms\n`);
  if (r.ms > r.budget) failures.push(r.name);
}
if (failures.length > 0) {
  process.stderr.write(`bench:core FAIL ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stderr.write("bench:core ok\n");
