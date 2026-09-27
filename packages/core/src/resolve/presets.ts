/**
 * Policy presets (FR-C065; research CR14): frozen data that compiles to the abstract policy of the
 * resolution input. A preset cannot express anything the abstract policy cannot.
 */
import { OpenThemeCoreError, operationalError } from "../errors/operational.js";
import { isRecord } from "../engine/model.js";
import { STANDARD_POINTS } from "../engine/registry.js";
import type { Snapshot } from "../registry/snapshot.js";
import type { ResolutionInput } from "./pipeline.js";

export type AbstractPolicy = NonNullable<ResolutionInput["policy"]>;
export type PresetName = "closed" | "common-personalization";
export interface PresetPolicy {
  readonly preset: PresetName;
  readonly defaultTheme: string;
}
export type PolicyInput = AbstractPolicy | PresetPolicy;

export const PRESETS: Readonly<Record<PresetName, Readonly<Omit<AbstractPolicy, "availableThemes" | "defaultTheme">>>> =
  Object.freeze({
    closed: Object.freeze({
      permittedPoints: Object.freeze({}),
      allowedColorSchemes: Object.freeze(["light", "dark"]),
      accessibilityFloor: "wcag22-aa" as const,
    }),
    "common-personalization": Object.freeze({
      permittedPoints: Object.freeze(Object.fromEntries([...STANDARD_POINTS.keys()].map((id) => [id, Object.freeze({})]))),
      allowedColorSchemes: Object.freeze(["light", "dark"]),
      accessibilityFloor: "wcag22-aa" as const,
    }),
  });

export function isPreset(policy: unknown): policy is PresetPolicy {
  return isRecord(policy) && "preset" in policy;
}

/**
 * The abstract policy for `policy`. A preset's `availableThemes` is the trusted theme entries of
 * the snapshot (and the built-in baseline); `defaultTheme` comes from the host.
 */
export function compilePolicy(policy: PolicyInput, snapshot: Snapshot, operation: string): AbstractPolicy {
  if (!isPreset(policy)) return policy;
  const preset = PRESETS[policy.preset as PresetName];
  if (!preset || !Object.hasOwn(PRESETS, policy.preset)) {
    throw new OpenThemeCoreError(operationalError("unknown-preset", operation, "The policy preset is not known.", "/policy/preset"));
  }
  for (const k of Object.keys(policy)) {
    if (k !== "preset" && k !== "defaultTheme") {
      throw new OpenThemeCoreError(operationalError("invalid-argument", operation, "A preset policy takes only preset and defaultTheme.", `/policy/${k}`));
    }
  }
  if (typeof policy.defaultTheme !== "string") {
    throw new OpenThemeCoreError(operationalError("invalid-argument", operation, "A preset policy needs defaultTheme.", "/policy/defaultTheme"));
  }
  const trusted = new Set<string>([snapshot.baseline.id]);
  for (const e of snapshot.entries) if (e.kind === "theme" && e.trust === "trusted") trusted.add(e.id);
  return {
    availableThemes: [...trusted].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    defaultTheme: policy.defaultTheme,
    ...preset,
  };
}
