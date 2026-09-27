/**
 * SC-001 / SC-002: reference theme × reference host coverage against consumes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SweepImpl } from "../sweeps/impl.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, suffix);
    else if (name.endsWith(suffix)) out.push(full);
  }
  return out;
}

export type HostCoverageResult = {
  pairs: number;
  failures: string[];
};

export async function runHostCoverage(impl: SweepImpl): Promise<HostCoverageResult> {
  const failures: string[] = [];
  const themes = walk(join(repoRoot, "specification/themes/reference"), ".opentheme.json");
  const hosts = walk(join(repoRoot, "specification/hosts"), ".opentheme-host.json");
  let pairs = 0;

  for (const themePath of themes) {
    const theme = loadJson(themePath);
    const id = String(theme.id);
    for (const hostPath of hosts) {
      const host = loadJson(hostPath);
      pairs += 1;
      try {
        const resolved = await impl.resolve({
          theme,
          selection: { id },
          previous: null,
          platform: {
            colorScheme: "light",
            contrast: "standard",
            forcedColors: false,
            reducedMotion: false,
            textScale: 1,
          },
          environment: {
            sizeClass: "expanded",
            locale: "en",
            direction: "ltr",
          },
          preferences: {},
          policy: { availableThemes: [id] },
          host,
        });
        if (!resolved.accessibility.complete) {
          failures.push(`${id} × ${host.id}: incomplete`);
        }
        const consumes = host.consumes as
          | { contracts?: string[] }
          | undefined;
        for (const c of consumes?.contracts ?? []) {
          const base = c.replace(/@\d+$/, "");
          // std contracts appear in components map by id without @pin
          if (base.startsWith("std/") && !(base in resolved.components)) {
            failures.push(`${id} × ${host.id}: missing consume ${c}`);
          }
        }
      } catch (err) {
        failures.push(
          `${id} × ${String(host.id)}: ${(err as Error).message}`,
        );
      }
    }
  }

  return { pairs, failures };
}
