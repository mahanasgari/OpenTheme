/**
 * Traceability gate (FR-002, NFR-010).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walkJson(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkJson(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

export function checkTraceability(repoRoot: string): string[] {
  const errors: string[] = [];
  const rulesDoc = JSON.parse(
    readFileSync(
      join(repoRoot, "specification/registry/1.0/rules.json"),
      "utf8",
    ),
  ) as {
    rules: Array<{
      id: string;
      fixtures?: string[];
      requirements?: string[];
      description?: string;
      retired?: string;
    }>;
  };
  const ruleIds = new Set(rulesDoc.rules.map((r) => r.id));
  const fixturesRoot = join(repoRoot, "conformance/fixtures");
  const fixtureIds = new Set<string>();

  for (const file of walkJson(fixturesRoot)) {
    if (file.includes(`${join("conformance", "data")}`) || file.includes("freeze")) {
      continue;
    }
    let raw: { kind?: string; rules?: string[] };
    try {
      raw = JSON.parse(readFileSync(file, "utf8")) as {
        kind?: string;
        rules?: string[];
      };
    } catch {
      continue;
    }
    if (!raw.kind || !Array.isArray(raw.rules)) continue;
    const id = file
      .replace(/\\/g, "/")
      .split("conformance/fixtures/")[1]!
      .replace(/\.json$/, "");
    fixtureIds.add(id);
    for (const rule of raw.rules) {
      if (!ruleIds.has(rule)) {
        errors.push(`fixture ${id}: unknown rule ${rule}`);
      }
    }
  }

  for (const r of rulesDoc.rules) {
    if (r.retired) continue; // retired rules are never reported, so they have no fixtures
    const fixtures = r.fixtures ?? [];
    const isStub = (r.description ?? "").startsWith("Rule R-");
    if (fixtures.length === 0) {
      if (isStub) {
        process.stderr.write(
          `spec-lint traceability: stub rule ${r.id} has no fixtures\n`,
        );
      } else {
        errors.push(`rule ${r.id}: no fixtures`);
      }
      continue;
    }
    for (const f of fixtures) {
      const pathJson = join(fixturesRoot, `${f}.json`);
      const matched = [...fixtureIds].some(
        (id) => id === f || id.startsWith(`${f}/`) || f === id,
      );
      if (!existsSync(pathJson) && !matched) {
        errors.push(`rule ${r.id}: missing fixture ${f}`);
      }
    }
  }

  const frMentioned = new Set<string>();
  for (const r of rulesDoc.rules) {
    for (const req of r.requirements ?? []) {
      if (/^FR-\d{3}$/.test(req)) frMentioned.add(req);
    }
  }
  const specDir = join(repoRoot, "specification/spec");
  if (existsSync(specDir)) {
    for (const name of readdirSync(specDir)) {
      if (!name.endsWith(".md")) continue;
      const text = readFileSync(join(specDir, name), "utf8");
      for (const m of text.matchAll(/\bFR-(\d{3})\b/g)) {
        frMentioned.add(`FR-${m[1]}`);
      }
    }
  }
  for (let i = 1; i <= 99; i += 1) {
    const fr = `FR-${String(i).padStart(3, "0")}`;
    if (!frMentioned.has(fr)) {
      process.stderr.write(
        `spec-lint traceability: ${fr} not cited in rules/chapters\n`,
      );
    }
  }

  return errors;
}
