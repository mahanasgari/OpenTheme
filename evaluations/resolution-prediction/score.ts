#!/usr/bin/env node
/** Score resolution-prediction answers against fixture expects (SC-009). */
import { readFileSync } from "node:fs";

function main(): void {
  const idx = process.argv.indexOf("--answers");
  const path = idx >= 0 ? process.argv[idx + 1] : "";
  if (!path) {
    process.stderr.write("Usage: score.ts --answers <file>\n");
    process.exit(3);
  }
  const answers = JSON.parse(readFileSync(path, "utf8")) as {
    total: number;
    correct: number;
  };
  const rate = answers.correct / answers.total;
  process.stdout.write(JSON.stringify({ rate, pass: rate >= 0.95 }) + "\n");
  process.exit(rate >= 0.95 ? 0 : 1);
}

main();
