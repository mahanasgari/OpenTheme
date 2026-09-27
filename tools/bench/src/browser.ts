/** Browser bench entry for SC-010 (manual on reference device). */
export function browserBenchNote(): string {
  return "Run tools/bench/index.html on the mid-range Android reference device before release.";
}

process.stderr.write(`${browserBenchNote()}\n`);
