/**
 * Web adapter benchmarks in Node (research WR9; SC-W006; T033), using happy-dom for the DOM:
 * apply ≤ 4 ms and a context-change update ≤ 4 ms (medians). A real browser is usually faster at
 * CSS object model writes; bench/browser.ts measures there.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { runWebBench } from "./cases.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, here.endsWith("dist") ? "../../../.." : "../../..");
const window = new Window();
const results = runWebBench(
  window.document as unknown as Document,
  readFileSync(join(root, "tools/bench/fixtures/typical.opentheme.json"), "utf8"),
  () => performance.now(),
);
await window.happyDOM.close();
const failures: string[] = [];
for (const r of results) {
  process.stderr.write(`bench:web ${r.name} median=${r.ms.toFixed(2)}ms budget=${r.budget}ms declarations=${r.declarations}\n`);
  if (r.ms > r.budget) failures.push(r.name);
}
if (failures.length > 0) {
  process.stderr.write(`bench:web FAIL ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stderr.write("bench:web ok\n");
