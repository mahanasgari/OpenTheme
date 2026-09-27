import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type FixtureOutcome = {
  id: string;
  status: "pass" | "fail" | "unsupported" | "timeout" | "error";
  failures?: string[];
  message?: string;
};

export function writeReports(
  reportDir: string,
  outcomes: FixtureOutcome[],
): void {
  mkdirSync(reportDir, { recursive: true });

  const passed = outcomes.filter((o) => o.status === "pass").length;
  const failed = outcomes.filter((o) => o.status === "fail").length;
  const unsupported = outcomes.filter((o) => o.status === "unsupported").length;
  const timedOut = outcomes.filter((o) => o.status === "timeout").length;
  const errored = outcomes.filter((o) => o.status === "error").length;

  const summary = {
    total: outcomes.length,
    passed,
    failed,
    unsupported,
    timedOut,
    errored,
    outcomes,
  };
  writeFileSync(
    join(reportDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );

  const cases = outcomes
    .map((o) => {
      const time = "0";
      if (o.status === "pass") {
        return `    <testcase name="${escapeXml(o.id)}" time="${time}"/>`;
      }
      const msg = escapeXml(
        (o.failures ?? []).join("; ") || o.message || o.status,
      );
      const tag =
        o.status === "unsupported"
          ? "skipped"
          : o.status === "timeout" || o.status === "error"
            ? "error"
            : "failure";
      return `    <testcase name="${escapeXml(o.id)}" time="${time}">\n      <${tag} message="${msg}"/>\n    </testcase>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="opentheme-conformance" tests="${outcomes.length}" failures="${failed}" errors="${errored + timedOut}" skipped="${unsupported}">
${cases}
</testsuite>
`;
  writeFileSync(join(reportDir, "junit.xml"), xml);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printSummary(outcomes: FixtureOutcome[]): void {
  const passed = outcomes.filter((o) => o.status === "pass").length;
  const failed = outcomes.filter((o) => o.status !== "pass");
  process.stderr.write(
    `conformance: ${passed}/${outcomes.length} passed\n`,
  );
  for (const o of failed) {
    process.stderr.write(
      `  ${o.status.toUpperCase()} ${o.id}${o.failures?.length ? `: ${o.failures[0]}` : o.message ? `: ${o.message}` : ""}\n`,
    );
  }
}
