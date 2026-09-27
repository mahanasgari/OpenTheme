/**
 * Host settings (data-model §1; research CR13; FR-C024, FR-C028, FR-C072, FR-C074). Fixed when a
 * Core instance is created, except the untrusted-source and gate settings, which a host may change
 * later (FR-C027). None of them is a specification limit or part of the resolution input.
 */
import { OpenThemeCoreError, operationalError } from "./errors/operational.js";
import { isRecord } from "./engine/model.js";

export const UNTRUSTED_SOURCES = ["user-created", "imported", "shared", "ai-generated"] as const;
export type UntrustedSource = (typeof UNTRUSTED_SOURCES)[number];

export interface CoreSettings {
  readonly untrustedSources?: Partial<Readonly<Record<UntrustedSource, boolean>>>;
  readonly accessibilityGate?: "enforce" | "relaxed";
  readonly registryCapacity?: number;
  readonly cache?: { readonly preparedThemes?: number; readonly results?: number };
}

export interface EffectiveSettings {
  readonly untrustedSources: Readonly<Record<UntrustedSource, boolean>>;
  readonly accessibilityGate: "enforce" | "relaxed";
  readonly registryCapacity: number;
  readonly cache: { readonly preparedThemes: number; readonly results: number };
}

export const DEFAULT_SETTINGS: EffectiveSettings = Object.freeze({
  untrustedSources: Object.freeze({ "user-created": false, imported: false, shared: false, "ai-generated": false }),
  accessibilityGate: "enforce",
  registryCapacity: 256,
  cache: Object.freeze({ preparedThemes: 16, results: 32 }),
});

function invalid(operation: string, pointer: string, message: string): never {
  throw new OpenThemeCoreError(operationalError("invalid-argument", operation, message, pointer));
}

function onlyKeys(v: Record<string, unknown>, allowed: readonly string[], operation: string, at: string): void {
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) invalid(operation, `${at}/${k}`, `Unknown setting at ${at}/${k}.`);
  }
}

function count(v: unknown, min: number, operation: string, pointer: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) {
    invalid(operation, pointer, `Setting at ${pointer} must be an integer of at least ${min}.`);
  }
  return v;
}

/** Validates settings and applies the secure defaults; throws `invalid-argument` otherwise. */
export function effectiveSettings(
  settings: unknown,
  base: EffectiveSettings = DEFAULT_SETTINGS,
  operation = "createCore",
): EffectiveSettings {
  if (settings === undefined) return base;
  if (!isRecord(settings)) invalid(operation, "", "Settings must be an object.");
  onlyKeys(settings, ["untrustedSources", "accessibilityGate", "registryCapacity", "cache"], operation, "");
  const sources: Record<UntrustedSource, boolean> = { ...base.untrustedSources };
  if (settings.untrustedSources !== undefined) {
    const s = settings.untrustedSources;
    if (!isRecord(s)) invalid(operation, "/untrustedSources", "untrustedSources must be an object.");
    onlyKeys(s, UNTRUSTED_SOURCES, operation, "/untrustedSources");
    for (const [k, v] of Object.entries(s)) {
      if (typeof v !== "boolean") invalid(operation, `/untrustedSources/${k}`, `untrustedSources.${k} must be a boolean.`);
      sources[k as UntrustedSource] = v;
    }
  }
  let gate = base.accessibilityGate;
  if (settings.accessibilityGate !== undefined) {
    if (settings.accessibilityGate !== "enforce" && settings.accessibilityGate !== "relaxed") {
      invalid(operation, "/accessibilityGate", 'accessibilityGate must be "enforce" or "relaxed".');
    }
    gate = settings.accessibilityGate;
  }
  const capacity =
    settings.registryCapacity === undefined ? base.registryCapacity : count(settings.registryCapacity, 1, operation, "/registryCapacity");
  const cache = { ...base.cache };
  if (settings.cache !== undefined) {
    const c = settings.cache;
    if (!isRecord(c)) invalid(operation, "/cache", "cache must be an object.");
    onlyKeys(c, ["preparedThemes", "results"], operation, "/cache");
    if (c.preparedThemes !== undefined) cache.preparedThemes = count(c.preparedThemes, 0, operation, "/cache/preparedThemes");
    if (c.results !== undefined) cache.results = count(c.results, 0, operation, "/cache/results");
  }
  return Object.freeze({
    untrustedSources: Object.freeze(sources),
    accessibilityGate: gate,
    registryCapacity: capacity,
    cache: Object.freeze(cache),
  });
}
