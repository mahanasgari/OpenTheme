/**
 * Browser page for Core (tasks T084, T087): the determinism hashes of every resolution fixture,
 * compared with the golden hashes, and the R22 benchmark medians. Data is embedded by
 * bench/browser.ts; nothing is fetched.
 */
import { runBench } from "./cases.js";
import { runPhases } from "./phases.js";
import { type DeterminismCase, runDeterminism } from "./determinism.js";

interface PageData {
  readonly cases: DeterminismCase[];
  readonly golden: Record<string, string>;
  readonly typical: string;
  readonly aurora: string;
}

const data = JSON.parse(document.getElementById("data")!.textContent!) as PageData;
const out = document.getElementById("out")!;
const log = (line: string) => {
  out.textContent += `${line}\n`;
};

/** `?phases`: the at-limit case's phase breakdown (bench/phases.ts). */
function phases(): void {
  for (const p of runPhases(() => performance.now())) log(`phase ${p.name} ${p.ms.toFixed(1)}ms`);
  log("done");
}

if (location.search.includes("phases")) setTimeout(phases, 0);
else setTimeout(() => {
  const hashes = runDeterminism(data.cases);
  const differing = Object.keys(data.golden).filter((id) => hashes[id] !== data.golden[id]);
  log(`determinism: ${differing.length === 0 ? "PASS" : "FAIL"} (${Object.keys(hashes).length} fixtures, ${differing.length} differ)`);
  for (const id of differing.slice(0, 20)) log(`  differs: ${id}`);
  for (const r of runBench(data.typical, data.aurora, () => performance.now())) {
    log(`bench: ${r.name} median=${r.ms.toFixed(2)}ms budget=${r.budget}ms ${r.ms <= r.budget ? "ok" : "OVER"}`);
  }
  log("done");
  document.title = differing.length === 0 ? "OpenTheme Core: PASS" : "OpenTheme Core: FAIL";
}, 0);
