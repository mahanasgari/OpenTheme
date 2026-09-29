/**
 * Layer 3 user preferences (FR-041…FR-045, FR-085).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import {
  enforcePreference,
  type EffectiveConstraints,
} from "./enforce.js";
import type { Declaration } from "./declare.js";
import type { PreferenceRecord } from "./context.js";

interface StandardPoint {
  id: string;
  type: string;
  target: string[] | { dimension?: string; textScale?: string };
  constraints?: {
    range?: {
      min?: number;
      max?: number;
      step?: number;
      gamut?: string;
      opaque?: boolean;
    };
    enum?: unknown[];
  };
  default?: unknown;
  effectiveRange?: { min: number; max: number };
}

interface ThemePoint {
  id: string;
  target?: string[] | { dimension?: string; textScale?: string };
  type?: string;
  default?: unknown;
  constraints?: StandardPoint["constraints"];
  effectiveRange?: { min: number; max: number };
}

let standardPoints: Map<string, StandardPoint> | undefined;

function loadStandard(): Map<string, StandardPoint> {
  if (standardPoints) return standardPoints;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/customization-points.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    points: StandardPoint[];
  };
  standardPoints = new Map(data.points.map((p) => [p.id, p]));
  return standardPoints;
}

function themePoints(theme: Record<string, unknown>): ThemePoint[] {
  const cus = theme.customization as { points?: ThemePoint[] } | undefined;
  return Array.isArray(cus?.points) ? cus.points : [];
}

function permittedIds(
  policy: { permittedPoints?: Record<string, unknown> | string[] } | undefined,
  declared: Set<string>,
): Set<string> {
  if (!policy?.permittedPoints) return declared;
  const raw = policy.permittedPoints;
  const ids = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : Object.keys(raw);
  return new Set(ids.filter((id) => declared.has(id)));
}

function policyNarrowing(
  pointId: string,
  base: StandardPoint["constraints"],
  policy: { permittedPoints?: Record<string, unknown> } | undefined,
  documentedDefault: unknown,
  collector: DiagnosticCollector,
): {
  constraints: StandardPoint["constraints"] | undefined;
  defaultValue: unknown;
  ok: boolean;
} {
  const entry = policy?.permittedPoints;
  if (!entry || Array.isArray(entry) || !(pointId in entry)) {
    return { constraints: base, defaultValue: documentedDefault, ok: true };
  }
  const narrow = entry[pointId] as {
    constraints?: StandardPoint["constraints"];
    default?: unknown;
  };
  if (!narrow || typeof narrow !== "object") {
    return { constraints: base, defaultValue: documentedDefault, ok: true };
  }
  let constraints = base;
  let defaultValue = documentedDefault;
  if (narrow.constraints) {
    constraints = mergeNarrow(base, narrow.constraints);
  }
  if (narrow.default !== undefined) {
    defaultValue = narrow.default;
  }
  // Narrowing that excludes the default requires a replacement (FR-043)
  if (
    constraints?.range &&
    typeof defaultValue === "number" &&
    typeof constraints.range.min === "number" &&
    typeof constraints.range.max === "number" &&
    (defaultValue < constraints.range.min || defaultValue > constraints.range.max) &&
    narrow.default === undefined
  ) {
    collector.add({
      code: "OT-CUS-001",
      rule: "R-CUS-001",
      location: {
        document: "input",
        pointer: `/policy/permittedPoints/${pointId}`,
      },
      params: { detail: pointId },
    });
    return { constraints, defaultValue, ok: false };
  }
  return { constraints, defaultValue, ok: true };
}

function mergeNarrow(
  base: StandardPoint["constraints"] | undefined,
  narrow: NonNullable<StandardPoint["constraints"]>,
): StandardPoint["constraints"] {
  if (!base) return narrow;
  if (base.range && narrow.range) {
    const nRange = narrow.range;
    const bRange = base.range;
    const min = Math.max(bRange.min ?? -Infinity, nRange.min ?? -Infinity);
    const max = Math.min(bRange.max ?? Infinity, nRange.max ?? Infinity);
    const step = nRange.step ?? bRange.step;
    const range: NonNullable<NonNullable<StandardPoint["constraints"]>["range"]> = {
      ...bRange,
      ...nRange,
    };
    if (Number.isFinite(min)) range.min = min;
    else if (nRange.min !== undefined) range.min = nRange.min;
    if (Number.isFinite(max)) range.max = max;
    else if (nRange.max !== undefined) range.max = nRange.max;
    if (step !== undefined) range.step = step;
    return { range };
  }
  if (base.enum && narrow.enum) {
    const allowed = new Set(narrow.enum.map((v) => JSON.stringify(v)));
    return { enum: base.enum.filter((v) => allowed.has(JSON.stringify(v))) };
  }
  return narrow;
}

function toEnforceConstraints(
  c: StandardPoint["constraints"] | undefined,
  type: string,
): EffectiveConstraints | null {
  if (!c) return null;
  if (c.range?.gamut === "srgb") {
    return { kind: "color", gamut: "srgb", opaque: true };
  }
  if (
    c.range &&
    typeof c.range.min === "number" &&
    typeof c.range.max === "number"
  ) {
    const out: EffectiveConstraints = {
      kind: "range",
      min: c.range.min,
      max: c.range.max,
    };
    if (typeof c.range.step === "number") {
      (out as { step?: number }).step = c.range.step;
    }
    return out;
  }
  if (c.enum) {
    return { kind: "enum", values: c.enum };
  }
  if (type === "color") {
    return { kind: "color", gamut: "srgb", opaque: true };
  }
  return null;
}

function resolveTargets(
  point: ThemePoint,
  registry: StandardPoint | undefined,
): string[] | { dimension: string } | { textScale: string } | null {
  const t = point.target ?? registry?.target;
  if (!t) return null;
  if (Array.isArray(t)) return t;
  if (typeof t === "object" && "dimension" in t && typeof t.dimension === "string") {
    return { dimension: t.dimension };
  }
  if (typeof t === "object" && "textScale" in t) {
    return { textScale: "in-app" };
  }
  return null;
}

/** Prefix/path matching for policy.protected (resolution contract). */
export function isProtectedPath(path: string, prefixes: string[]): boolean {
  for (const p of prefixes) {
    if (!p) continue;
    if (path === p || path.startsWith(`${p}.`)) return true;
  }
  return false;
}

export interface ApplyPreferencesInput {
  theme: Record<string, unknown>;
  previousTheme?: Record<string, unknown> | null | undefined;
  preferences: Record<string, unknown>;
  policy?: {
    permittedPoints?: Record<string, unknown> | string[];
    protected?: string[];
  } | undefined;
  /** Preference statuses already recorded by context for dimension points. */
  status: Record<string, PreferenceRecord>;
}

export interface ApplyPreferencesResult {
  decls: Map<string, Declaration>;
  status: Record<string, PreferenceRecord>;
  /** In-app text factor after enforcement (default 1). */
  inAppTextFactor: number;
  /** Effective range for text scale after policy narrowing. */
  textEffectiveRange: { min: number; max: number };
}

/**
 * Apply layer-3 preferences onto the declaration map (token targets only).
 * Dimension-targeted points are handled in resolveContext.
 */
export function applyPreferences(
  decls: Map<string, Declaration>,
  input: ApplyPreferencesInput,
  collector: DiagnosticCollector,
): ApplyPreferencesResult {
  const std = loadStandard();
  const points = themePoints(input.theme);
  const declared = new Set(points.map((p) => p.id));
  const permitted = permittedIds(input.policy, declared);
  const protectedPrefixes = input.policy?.protected ?? [];
  const status: Record<string, PreferenceRecord> = { ...input.status };
  const out = new Map(decls);

  let inAppTextFactor = 1;
  let textEffectiveRange = { min: 1, max: 3 };

  const previousDeclared = new Set(
    input.previousTheme ? themePoints(input.previousTheme).map((p) => p.id) : [],
  );

  // CUS-104: preference for a point removed since previous version of same theme
  const themeId = String(input.theme.id ?? "");
  const prevId = input.previousTheme
    ? String(input.previousTheme.id ?? "")
    : "";
  for (const key of Object.keys(input.preferences)) {
    if (
      previousDeclared.has(key) &&
      !declared.has(key) &&
      themeId &&
      themeId === prevId
    ) {
      collector.add({
        code: "OT-CUS-104",
        rule: "R-CUS-104",
        location: {
          document: "input",
          pointer: `/preferences/${key}`,
        },
        params: { point: key },
        severity: "info",
      });
      status[key] = { status: "skipped" };
      continue;
    }
  }

  // Last-declared wins among token-target points sharing a target
  const byTarget = new Map<
    string,
    { point: ThemePoint; registry?: StandardPoint | undefined }
  >();

  for (const point of points) {
    const registry = std.get(point.id);
    if (!(point.id in input.preferences)) continue;
    if (status[point.id]?.status === "skipped") continue;

    if (!permitted.has(point.id)) {
      if (!status[point.id]) {
        collector.add({
          code: "OT-CUS-103",
          rule: "R-CUS-103",
          location: {
            document: "input",
            pointer: `/preferences/${point.id}`,
          },
          params: { point: point.id },
          severity: "info",
        });
        status[point.id] = { status: "skipped" };
      }
      continue;
    }

    const targets = resolveTargets(point, registry);
    if (!targets || !Array.isArray(targets)) {
      continue;
    }

    for (const path of targets) {
      byTarget.set(path, { point, registry });
    }
  }

  for (const [path, { point, registry }] of byTarget) {
    if (isProtectedPath(path, protectedPrefixes)) {
      if (!status[point.id]) {
        status[point.id] = { status: "skipped", value: input.preferences[point.id] };
      }
      continue;
    }
    const rawValue = input.preferences[point.id];
    const type = point.type ?? registry?.type ?? "color";
    const baseConstraints = point.constraints ?? registry?.constraints;
    let documentedDefault =
      point.default ?? registry?.default ?? out.get(path)?.value ?? null;

    // std.accent default = current seed accent
    if (point.id === "std.accent" && documentedDefault === null) {
      documentedDefault = out.get("seed.accent")?.value ?? documentedDefault;
    }

    const narrowed = policyNarrowing(
      point.id,
      baseConstraints,
      input.policy as { permittedPoints?: Record<string, unknown> },
      documentedDefault,
      collector,
    );
    if (!narrowed.ok) {
      status[point.id] = { status: "rejected", value: rawValue };
      continue;
    }

    const enforceConstraints = toEnforceConstraints(narrowed.constraints, type);
    if (!enforceConstraints) {
      status[point.id] = { status: "skipped", value: rawValue };
      continue;
    }

    const result = enforcePreference(
      rawValue,
      enforceConstraints,
      narrowed.defaultValue,
    );
    if (result.diagnostic === "OT-CUS-101") {
      collector.add({
        code: "OT-CUS-101",
        rule: "R-CUS-101",
        location: {
          document: "input",
          pointer: `/preferences/${point.id}`,
        },
        params: { point: point.id },
        severity: "info",
      });
    } else if (result.diagnostic === "OT-CUS-102") {
      collector.add({
        code: "OT-CUS-102",
        rule: "R-CUS-102",
        location: {
          document: "input",
          pointer: `/preferences/${point.id}`,
        },
        params: { point: point.id },
        severity: "info",
      });
    }

    const prefStatus: PreferenceRecord["status"] =
      result.status === "unchanged"
        ? "effective"
        : result.status === "clamped"
          ? "clamped"
          : "fell-back";
    status[point.id] = { status: prefStatus, value: result.value };

    // std.accent applies to seed.accent (all schemes share the seed path in decls)
    out.set(path, {
      path,
      type: out.get(path)?.type ?? type,
      value: result.value,
      source: "theme",
      // A value that fell back to the default no longer depends on the user (chapter 04).
      ...(prefStatus === "fell-back" ? {} : { user: `/preferences/${point.id}` }),
    });
  }

  // std.text-size → in-app factor
  if (
    declared.has("std.text-size") &&
    permitted.has("std.text-size") &&
    "std.text-size" in input.preferences
  ) {
    const registry = std.get("std.text-size")!;
    const point =
      points.find((p) => p.id === "std.text-size") ??
      ({ id: "std.text-size" } as ThemePoint);
    const baseConstraints = point.constraints ?? registry.constraints;
    const documentedDefault = point.default ?? registry.default ?? 1;
    const narrowed = policyNarrowing(
      "std.text-size",
      baseConstraints,
      input.policy as { permittedPoints?: Record<string, unknown> },
      documentedDefault,
      collector,
    );
    const enforceConstraints = toEnforceConstraints(
      narrowed.constraints,
      "number",
    );
    if (enforceConstraints) {
      const result = enforcePreference(
        input.preferences["std.text-size"],
        enforceConstraints,
        narrowed.defaultValue,
      );
      if (result.diagnostic) {
        collector.add({
          code: result.diagnostic,
          rule: result.diagnostic.replace(/^OT-/, "R-"),
          location: {
            document: "input",
            pointer: "/preferences/std.text-size",
          },
          params: { point: "std.text-size" },
          severity: "info",
        });
      }
      if (typeof result.value === "number") {
        inAppTextFactor = result.value;
      }
      status["std.text-size"] = {
        status:
          result.status === "unchanged"
            ? "effective"
            : result.status === "clamped"
              ? "clamped"
              : "fell-back",
        value: result.value,
      };
    }
    const er = point.effectiveRange ?? registry.effectiveRange ?? { min: 1, max: 3 };
    // Policy may narrow effectiveRange via permittedPoints entry
    const polEntry = (
      input.policy?.permittedPoints as Record<string, { effectiveRange?: { min: number; max: number } }> | undefined
    )?.["std.text-size"];
    if (polEntry?.effectiveRange) {
      textEffectiveRange = {
        min: Math.max(er.min, polEntry.effectiveRange.min),
        max: Math.min(er.max, polEntry.effectiveRange.max),
      };
    } else {
      textEffectiveRange = { ...er };
    }
  }

  // Preference keys not in the effective set → CUS-103 (unless already CUS-104)
  for (const key of Object.keys(input.preferences)) {
    if (status[key]) continue;
    if (!declared.has(key) || !permitted.has(key)) {
      collector.add({
        code: "OT-CUS-103",
        rule: "R-CUS-103",
        location: {
          document: "input",
          pointer: `/preferences/${key}`,
        },
        params: { point: key },
        severity: "info",
      });
      status[key] = { status: "skipped" };
    }
  }

  return { decls: out, status, inAppTextFactor, textEffectiveRange };
}
