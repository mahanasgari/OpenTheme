import type { DiagnosticCollector } from "../diagnostics/collector.js";

export interface PlatformInput {
  colorScheme: "light" | "dark" | "no-preference";
  contrast: "standard" | "high";
  forcedColors: boolean;
  reducedMotion: boolean;
  textScale: number;
}

export interface EnvironmentInput {
  sizeClass: "compact" | "medium" | "expanded";
  locale: string;
  direction: "ltr" | "rtl";
}

export interface PolicyContext {
  allowedColorSchemes?: string[];
  permittedPoints?: Record<string, unknown> | string[];
}

export interface EffectiveContext {
  colorScheme: string;
  /** Scheme used for seed lookup (variant fallback applied). */
  seedScheme: string;
  contrast: "standard" | "high";
  motion: "standard" | "reduced";
  density: string;
  sizeClass: string;
  textScale: number;
  forcedColors: boolean;
  direction: "ltr" | "rtl";
  locale: string;
}

export type PreferenceStatus =
  | "effective"
  | "clamped"
  | "fell-back"
  | "skipped"
  | "rejected";

export interface PreferenceRecord {
  status: PreferenceStatus;
  value?: unknown;
}

function themeDeclaredPoints(theme: Record<string, unknown>): Set<string> {
  const cus = theme.customization as { points?: Array<{ id?: string }> } | undefined;
  const out = new Set<string>();
  for (const p of cus?.points ?? []) {
    if (typeof p?.id === "string") out.add(p.id);
  }
  return out;
}

function permittedSet(
  policy: PolicyContext | undefined,
  declared: Set<string>,
): Set<string> | null {
  if (!policy?.permittedPoints) return declared;
  const raw = policy.permittedPoints;
  const ids = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : Object.keys(raw);
  return new Set(ids.filter((id) => declared.has(id)));
}

function isPointAllowed(
  pointId: string,
  declared: Set<string>,
  permitted: Set<string> | null,
  preferences: Record<string, unknown>,
  collector: DiagnosticCollector,
): boolean {
  if (!(pointId in preferences)) return false;
  if (!declared.has(pointId) || (permitted && !permitted.has(pointId))) {
    collector.add({
      code: "OT-CUS-103",
      rule: "R-CUS-103",
      location: {
        document: "input",
        pointer: `/preferences/${pointId}`,
      },
      params: { point: pointId },
      severity: "info",
    });
    return false;
  }
  return true;
}

function variantFallback(
  theme: Record<string, unknown>,
  scheme: string,
): string {
  const schemes = theme.colorSchemes as
    | {
        variants?: Record<string, { fallback?: string }>;
      }
    | undefined;
  const fb = schemes?.variants?.[scheme]?.fallback;
  return typeof fb === "string" ? fb : scheme;
}

/**
 * Compute the effective context for resolution (stage 2).
 * Returns preference status map for dimension-targeted standard points.
 */
export function resolveContext(
  theme: Record<string, unknown>,
  platform: PlatformInput,
  environment: EnvironmentInput,
  preferences: Record<string, unknown>,
  policy: PolicyContext | undefined,
  collector: DiagnosticCollector,
): { context: EffectiveContext; preferences: Record<string, PreferenceRecord> } {
  const prefStatus: Record<string, PreferenceRecord> = {};
  const declared = themeDeclaredPoints(theme);
  const permitted = permittedSet(policy, declared);

  const schemes = theme.colorSchemes as
    | {
        supported?: string[];
        default?: string;
        variants?: Record<string, { fallback?: string }>;
      }
    | undefined;
  const supported = new Set(schemes?.supported ?? ["light"]);
  const themeDefault = schemes?.default ?? "light";
  const allowed = new Set(policy?.allowedColorSchemes ?? [...supported]);
  const intersection = [...supported].filter((s) => allowed.has(s));

  let colorScheme: string | undefined;
  const prefScheme = preferences["std.color-scheme"];
  if (
    isPointAllowed(
      "std.color-scheme",
      declared,
      permitted,
      preferences,
      collector,
    ) &&
    typeof prefScheme === "string" &&
    intersection.includes(prefScheme)
  ) {
    colorScheme = prefScheme;
    prefStatus["std.color-scheme"] = {
      status: "effective",
      value: prefScheme,
    };
  } else if (typeof prefScheme === "string" && "std.color-scheme" in preferences) {
    if (
      declared.has("std.color-scheme") &&
      (!permitted || permitted.has("std.color-scheme"))
    ) {
      // Declared but outside intersection — fall through
      prefStatus["std.color-scheme"] = { status: "fell-back", value: prefScheme };
    }
  }

  if (!colorScheme) {
    if (
      platform.colorScheme !== "no-preference" &&
      intersection.includes(platform.colorScheme)
    ) {
      colorScheme = platform.colorScheme;
    } else if (intersection.includes(themeDefault)) {
      colorScheme = themeDefault;
      if (
        platform.colorScheme !== "no-preference" &&
        !intersection.includes(platform.colorScheme)
      ) {
        collector.add({
          code: "OT-CTX-101",
          rule: "R-CTX-101",
          location: { document: "input", pointer: "/platform/colorScheme" },
          params: { detail: themeDefault },
          severity: "info",
        });
      }
    } else if (intersection.length > 0) {
      colorScheme = intersection[0];
      if (
        platform.colorScheme !== "no-preference" &&
        !intersection.includes(platform.colorScheme)
      ) {
        collector.add({
          code: "OT-CTX-101",
          rule: "R-CTX-101",
          location: { document: "input", pointer: "/platform/colorScheme" },
          params: { detail: colorScheme },
          severity: "info",
        });
      }
    } else {
      colorScheme = themeDefault;
      collector.add({
        code: "OT-CTX-101",
        rule: "R-CTX-101",
        location: { document: "input", pointer: "/platform/colorScheme" },
        params: { detail: themeDefault },
        severity: "info",
      });
    }
  }

  if (!supported.has(colorScheme!)) {
    colorScheme = themeDefault;
    collector.add({
      code: "OT-CTX-101",
      rule: "R-CTX-101",
      location: { document: "input", pointer: "/platform/colorScheme" },
      params: { detail: themeDefault },
      severity: "info",
    });
  }

  // Contrast: platform/user may only raise accessibility (FR-052).
  let contrast: "standard" | "high" =
    platform.contrast === "high" ? "high" : "standard";
  if (
    isPointAllowed(
      "std.contrast",
      declared,
      permitted,
      preferences,
      collector,
    )
  ) {
    const prefContrast = preferences["std.contrast"];
    if (prefContrast === "high") {
      contrast = "high";
      prefStatus["std.contrast"] = { status: "effective", value: "high" };
    } else if (prefContrast === "standard") {
      // Cannot remove platform high contrast
      prefStatus["std.contrast"] = {
        status: platform.contrast === "high" ? "rejected" : "effective",
        value: "standard",
      };
    }
  }

  // Motion: same ratchet
  let motion: "standard" | "reduced" = platform.reducedMotion
    ? "reduced"
    : "standard";
  if (
    isPointAllowed("std.motion", declared, permitted, preferences, collector)
  ) {
    const prefMotion = preferences["std.motion"];
    if (prefMotion === "reduced") {
      motion = "reduced";
      prefStatus["std.motion"] = { status: "effective", value: "reduced" };
    } else if (prefMotion === "standard") {
      prefStatus["std.motion"] = {
        status: platform.reducedMotion ? "rejected" : "effective",
        value: "standard",
      };
    }
  }

  let density = "standard";
  if (
    isPointAllowed("std.density", declared, permitted, preferences, collector)
  ) {
    const prefDensity = preferences["std.density"];
    if (typeof prefDensity === "string") {
      density = prefDensity;
      prefStatus["std.density"] = { status: "effective", value: prefDensity };
    }
  }

  // Record skipped unknown preference keys for dimension points only;
  // token-target / local points (including removed-point CUS-104) are handled in applyPreferences.
  for (const key of Object.keys(preferences)) {
    if (prefStatus[key]) continue;
    if (
      key === "std.color-scheme" ||
      key === "std.contrast" ||
      key === "std.motion" ||
      key === "std.density" ||
      key === "std.text-size" ||
      key === "std.accent" ||
      key === "std.corner-roundness" ||
      !key.startsWith("std.")
    ) {
      continue;
    }
    if (!declared.has(key) || (permitted && !permitted.has(key))) {
      isPointAllowed(key, declared, permitted, preferences, collector);
      prefStatus[key] = { status: "skipped" };
    }
  }

  const seedScheme = variantFallback(theme, colorScheme!);

  return {
    context: {
      colorScheme: colorScheme!,
      seedScheme,
      contrast,
      motion,
      density,
      sizeClass: environment.sizeClass,
      textScale: platform.textScale > 0 ? platform.textScale : 1,
      forcedColors: platform.forcedColors,
      direction: environment.direction,
      locale: environment.locale,
    },
    preferences: prefStatus,
  };
}
