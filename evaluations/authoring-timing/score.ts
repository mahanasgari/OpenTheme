#!/usr/bin/env node
/** Score authoring-timing results (SC-007). */
import { readFileSync } from "node:fs";

function main(): void {
  const idx = process.argv.indexOf("--results");
  const path = idx >= 0 ? process.argv[idx + 1] : "";
  if (!path) {
    process.stderr.write("Usage: score.ts --results <file>\n");
    process.exit(3);
  }
  const rows = JSON.parse(readFileSync(path, "utf8")) as Array<{
    seedOnlyMinutes: number;
    fullMinutes: number;
  }>;
  if (rows.length < 5) {
    process.stderr.write("need at least 5 participants\n");
    process.exit(1);
  }
  const ok = rows.filter(
    (r) => r.seedOnlyMinutes <= 15 && r.fullMinutes <= 30,
  ).length;
  const rate = ok / rows.length;
  process.stdout.write(JSON.stringify({ rate, pass: rate >= 0.8 }) + "\n");
  process.exit(rate >= 0.8 ? 0 : 1);
}

main();
