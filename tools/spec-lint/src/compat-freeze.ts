/**
 * SC-013: frozen fixture expects must not change without a CHANGELOG "bug fix" entry.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

export type FreezeResult = { ok: boolean; failures: string[] };

export function checkCompatFreeze(): FreezeResult {
  const failures: string[] = [];
  const freezePath = join(
    repoRoot,
    "conformance/data/freeze-1.0.json",
  );
  if (!existsSync(freezePath)) {
    return { ok: false, failures: ["missing freeze-1.0.json"] };
  }
  const freeze = JSON.parse(readFileSync(freezePath, "utf8")) as {
    fixtures: Record<string, string>;
  };
  const fixturesRoot = join(repoRoot, "conformance/fixtures");
  const current: Record<string, string> = {};
  for (const full of walk(fixturesRoot)) {
    const rel = relative(fixturesRoot, full).replace(/\\/g, "/").replace(/\.json$/, "");
    if (!rel.startsWith("valid/") && !rel.startsWith("resolution/")) continue;
    const j = JSON.parse(readFileSync(full, "utf8")) as { expect?: unknown };
    if (!j.expect) continue;
    current[rel] = createHash("sha256")
      .update(JSON.stringify(j.expect))
      .digest("hex");
  }

  const changelog = existsSync(join(repoRoot, "specification/CHANGELOG.md"))
    ? readFileSync(join(repoRoot, "specification/CHANGELOG.md"), "utf8")
    : "";
  const bugFixOk = /bug fix/i.test(changelog);

  for (const [id, hash] of Object.entries(freeze.fixtures)) {
    if (!(id in current)) {
      if (!bugFixOk) {
        failures.push(`frozen fixture removed without changelog bug fix: ${id}`);
      }
      continue;
    }
    if (current[id] !== hash && !bugFixOk) {
      failures.push(
        `frozen expect changed without changelog bug fix: ${id}`,
      );
    }
  }

  return { ok: failures.length === 0, failures };
}
