/**
 * Browser page for Core (tasks T084, T087): the determinism hashes of every resolution fixture,
 * compared with the golden hashes, and the R22 benchmark medians. Data is embedded by
 * bench/browser.ts; nothing is fetched.
 */
import { atLimitTheme, ENVIRONMENT, PLATFORM, runBench } from "./cases.js";
import { computeIntegrity } from "../src/canonical/integrity.js";
import { parseIJson } from "../src/parse/ijson.js";
import { validateThemeDocument } from "../src/validate/theme.js";
import { resolve } from "../src/resolve/pipeline.js";
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

/** `?phases`: medians of the at-limit case's phases, to locate engine-specific costs. */
function phases(): void {
  const limit = JSON.stringify(atLimitTheme());
  const median = (f: () => unknown, runs = 7) => {
    const t: number[] = [];
    for (let i = 0; i < runs; i += 1) {
      const a = performance.now();
      f();
      t.push(performance.now() - a);
    }
    return t.sort((x, y) => x - y)[runs >> 1]!.toFixed(1);
  };
  const parse = () => parseIJson(limit, { maxBytes: 1_048_576, maxDepth: 16, freeze: true }) as Record<string, unknown>;
  const doc = parse();
  log(`phase parse ${median(parse)}ms`);
  log(`phase integrity ${median(() => computeIntegrity(doc))}ms`);
  log(`phase validate ${median(() => validateThemeDocument(parse(), {}))}ms (includes a parse)`);
  const input = { themes: [{ trust: "trusted", document: doc }], host: null, selection: { id: "com.example.at-limit" }, previous: null, platform: PLATFORM, environment: ENVIRONMENT, preferences: {}, policy: { availableThemes: ["com.example.at-limit"] } };
  log(`phase resolve ${median(() => resolve(input as never))}ms (includes validating the selected theme)`);
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
