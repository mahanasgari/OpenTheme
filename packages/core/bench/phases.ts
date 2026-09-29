/**
 * Phase breakdown of the at-limit case (research R22; T121): where admission and resolution
 * spend their time on a given engine. Reported, never gated. Pure: the caller supplies a clock.
 */
import { computeIntegrity } from "../src/canonical/integrity.js";
import { DiagnosticCollector } from "../src/diagnostics/collector.js";
import { parseIJson } from "../src/parse/ijson.js";
import { Prepared } from "../src/resolve/prepare.js";
import { resolve } from "../src/resolve/pipeline.js";
import { conformanceReport } from "../src/validate/accessibility.js";
import { themeSchemaFindings } from "../src/validate/schema.js";
import { validateThemeDocument } from "../src/validate/theme.js";
import { validateTokenTree } from "../src/validate/tokens.js";
import { atLimitTheme, ENVIRONMENT, PLATFORM } from "./cases.js";

export function runPhases(now: () => number): { name: string; ms: number }[] {
  const limit = JSON.stringify(atLimitTheme());
  const median = (f: () => unknown, runs = 7): number => {
    const t: number[] = [];
    for (let i = 0; i < runs; i += 1) {
      const a = now();
      f();
      t.push(now() - a);
    }
    return t.sort((x, y) => x - y)[runs >> 1]!;
  };
  // Each run gets a freshly parsed document, so nothing is reused between runs.
  const fresh = () => parseIJson(limit, { maxBytes: 1_048_576, maxDepth: 16, freeze: true }) as Record<string, unknown>;
  const doc = fresh();
  const parseMs = median(fresh);
  const input = (d: Record<string, unknown>) =>
    ({
      themes: [{ trust: "trusted", document: d }],
      host: null,
      selection: { id: "com.example.at-limit" },
      previous: null,
      platform: PLATFORM,
      environment: ENVIRONMENT,
      preferences: {},
      policy: { availableThemes: ["com.example.at-limit"] },
    }) as never;
  const prepared = new Prepared(4);
  validateThemeDocument(doc, { prepared });
  resolve(input(doc), prepared);
  return [
    { name: "parse", ms: parseMs },
    { name: "integrity", ms: median(() => computeIntegrity(doc)) },
    { name: "schema", ms: median(() => themeSchemaFindings(doc)) },
    { name: "token tree", ms: median(() => validateTokenTree(doc, new DiagnosticCollector("theme"), new Map())) },
    { name: "validate (all steps)", ms: median(() => validateThemeDocument(fresh(), {})) - parseMs },
    { name: "conformance report", ms: median(() => conformanceReport(fresh(), null, new DiagnosticCollector("theme"))) - parseMs },
    { name: "resolve (validation reused)", ms: median(() => resolve(input(doc), prepared)) },
  ];
}
