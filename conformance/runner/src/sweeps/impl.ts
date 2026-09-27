/**
 * Implementation access for sweeps and whole-suite checks.
 *
 * By default sweeps call the reference checker in-process (fast). With `--impl`, every
 * resolution and canonicalization is sent through NDJSON protocol 1 to the implementation under
 * test, so any conforming implementation can be swept (Core feature prerequisite P2).
 * Assertions (contrast measurement, completeness checks) always stay in the runner.
 */
import { computeIntegrity, resolveTheme } from "@opentheme/reference-checker";
import type { ProtocolClient } from "../protocol.js";
import { firstDifference, normalizeResult } from "../crosscheck.js";

export interface ResolvedPair {
  foreground: string;
  background: string;
  ratio: number;
  threshold: number;
  pass: boolean;
}

export interface ResolvedLike {
  tokens: Record<string, unknown>;
  components: Record<string, unknown>;
  preferences: Record<string, { status?: string } | undefined>;
  diagnostics: Array<{ code: string }>;
  accessibility: { complete?: boolean; pairs: ResolvedPair[] };
}

export interface SweepImpl {
  readonly label: string;
  resolve(input: Record<string, unknown>): Promise<ResolvedLike>;
  canonicalize(theme: Record<string, unknown>): Promise<{ canonical: string; integrity: string }>;
}

export function inProcessImpl(): SweepImpl {
  return {
    label: "reference-checker (in-process)",
    async resolve(input) {
      const { resolved } = resolveTheme(input as unknown as Parameters<typeof resolveTheme>[0]);
      return resolved as unknown as ResolvedLike;
    },
    async canonicalize(theme) {
      const { canonical, integrity } = computeIntegrity(theme);
      return { canonical, integrity };
    },
  };
}

export function protocolImpl(client: ProtocolClient): SweepImpl {
  let counter = 0;
  const call = async (kind: string, input: unknown): Promise<Record<string, unknown>> => {
    counter += 1;
    const id = `sweep/${kind}/${counter}`;
    const response = await client.request(id, kind, input);
    if (response.unsupported) throw new Error(`${kind} unsupported by ${client.implementation}`);
    if (response.error) throw new Error(response.error);
    return (response.result ?? {}) as Record<string, unknown>;
  };
  return {
    label: `${client.implementation}@${client.version} (protocol)`,
    async resolve(input) {
      const result = await call("resolve", input);
      return result.resolved as ResolvedLike;
    },
    async canonicalize(theme) {
      const result = await call("canonicalize", { theme });
      return { canonical: String(result.canonical), integrity: String(result.integrity) };
    },
  };
}

/** Wraps two implementations: results come from `a`; every difference from `b` is recorded. */
export function comparingImpl(
  a: SweepImpl,
  b: SweepImpl,
): SweepImpl & { differences: string[]; inputs: unknown[] } {
  const differences: string[] = [];
  /** Inputs whose results differ, in difference order (for `OT_CROSSCHECK_DUMP`). */
  const inputs: unknown[] = [];
  let n = 0;
  return {
    label: `${a.label} vs ${b.label}`,
    differences,
    inputs,
    async resolve(input) {
      n += 1;
      const [ra, rb] = await Promise.all([a.resolve(input), b.resolve(input)]);
      const d = firstDifference(normalizeResult(ra), normalizeResult(rb));
      if (d) {
        differences.push(`sweep#${n} ${d}`);
        inputs.push({ sweep: n, difference: d, input });
      }
      return ra;
    },
    async canonicalize(theme) {
      const [ra, rb] = await Promise.all([a.canonicalize(theme), b.canonicalize(theme)]);
      if (ra.canonical !== rb.canonical) differences.push("canonicalize differs");
      return ra;
    },
  };
}
