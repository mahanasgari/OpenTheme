/**
 * Tally manual diagnostic-review results (SC-005). Threshold: 90%.
 */
import { readFileSync } from "node:fs";

type Row = { id: string; pass: boolean };

function main(argv: string[]): void {
  const path = argv[0];
  if (!path) {
    process.stderr.write("usage: score.ts <results.json>\n");
    process.exit(2);
  }
  const rows = JSON.parse(readFileSync(path, "utf8")) as Row[];
  const total = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const rate = total === 0 ? 0 : passed / total;
  process.stdout.write(
    `diagnostic-review: ${passed}/${total} (${(rate * 100).toFixed(1)}%)\n`,
  );
  process.exit(rate >= 0.9 ? 0 : 1);
}

main(process.argv.slice(2));
