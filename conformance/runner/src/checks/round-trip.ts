/**
 * SC-011: every valid theme fixture round-trips through canonicalize.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SweepImpl } from "../sweeps/impl.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

export type RoundTripResult = {
  checked: number;
  failures: string[];
};

/**
 * For every fixture under valid/ whose theme document is inline or $file,
 * canonicalize twice and require identical bytes and integrity.
 */
export async function runRoundTripCheck(impl: SweepImpl): Promise<RoundTripResult> {
  const failures: string[] = [];
  let checked = 0;
  const validRoot = join(repoRoot, "conformance/fixtures/valid");
  for (const path of walk(validRoot)) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (raw.kind !== "validate") continue;
    const input = raw.input as Record<string, unknown> | undefined;
    if (!input) continue;
    let theme: Record<string, unknown> | undefined;
    if (input.theme && typeof input.theme === "object") {
      const t = input.theme as Record<string, unknown>;
      if (typeof t.$file === "string") {
        try {
          theme = JSON.parse(
            readFileSync(join(repoRoot, t.$file), "utf8"),
          ) as Record<string, unknown>;
        } catch {
          failures.push(`${path}: cannot read $file`);
          continue;
        }
      } else if (t.opentheme !== undefined) {
        theme = t;
      }
    }
    if (!theme) continue;
    checked += 1;
    try {
      const first = await impl.canonicalize(theme);
      const reparsed = JSON.parse(first.canonical) as Record<string, unknown>;
      const second = await impl.canonicalize(reparsed);
      if (first.canonical !== second.canonical) {
        failures.push(`${path}: canonical bytes changed after re-parse`);
      }
      if (first.integrity !== second.integrity) {
        failures.push(`${path}: integrity changed after re-parse`);
      }
    } catch (err) {
      failures.push(`${path}: ${(err as Error).message}`);
    }
  }
  return { checked, failures };
}
