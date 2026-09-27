/**
 * Conformance fixture access for Core tests. Inputs are expanded as the runner does (`$file` and
 * `generate`); the runner's generator has no dependency on the reference checker.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expandGenerate, type GenerateSpec } from "../../../conformance/runner/src/generate.js";
import { ROOT } from "./helpers.js";

export interface Fixture {
  readonly id: string;
  readonly kind: string;
  readonly input: Record<string, unknown>;
  readonly expect: { readonly validity?: string; readonly diagnostics?: readonly { code: string; location?: { document: string; pointer: string } }[] };
}

function expand(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(expand);
  const obj = value as Record<string, unknown>;
  if (typeof obj.$file === "string") return JSON.parse(readFileSync(join(ROOT, obj.$file), "utf8"));
  if (obj.generate && typeof obj.generate === "object") return expandGenerate(obj.generate as GenerateSpec);
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, expand(v)]));
}

export function fixtures(...dirs: string[]): Fixture[] {
  const out: Fixture[] = [];
  const base = join(ROOT, "conformance/fixtures");
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".json")) {
        const raw = JSON.parse(readFileSync(full, "utf8")) as Record<string, unknown>;
        const input = expand(raw.input) as Record<string, unknown>;
        out.push({
          id: relative(base, full).replace(/\\/g, "/").replace(/\.json$/, ""),
          kind: String(raw.kind),
          input: raw.kind === "validate" && input.theme === undefined && input.opentheme !== undefined ? { theme: input } : input,
          expect: raw.expect as Fixture["expect"],
        });
      }
    }
  };
  for (const d of dirs) walk(join(base, d));
  return out;
}

export const bytesOf = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));
