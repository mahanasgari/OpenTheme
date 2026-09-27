import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { canonicalize, type Json } from "../canonical/jcs.js";
import {
  selectTheme,
  type SelectInput,
  type FallbackKind,
  type TrustLevel,
} from "./select.js";
import {
  resolveContext,
  type EffectiveContext,
  type EnvironmentInput,
  type PlatformInput,
  type PreferenceRecord,
} from "./context.js";
import { applicableOverlays, declareTokens, type Declaration } from "./declare.js";
import { applyLocks } from "./policy.js";
import { applyPreferences } from "./preferences.js";
import { declarationRefs, evaluateDeclarations } from "./evaluate.js";
import { quantizeAll, type ResolvedTokenValue } from "./quantize.js";
import { forcedColorMap, lookupDisplayText, postprocessValues } from "./postprocess.js";
import {
  checkAccessibility,
  isComplete,
  resolveComponents,
  styledDeclarations,
  type AccessibilityReport,
} from "./check.js";
import { selectLayoutVariants } from "../validate/layout.js";
import { flattenTokens } from "../tokens/graph.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ResolveInput extends SelectInput {
  platform: PlatformInput;
  environment: EnvironmentInput;
  preferences?: Record<string, unknown>;
  policy?: SelectInput["policy"] & {
    allowedColorSchemes?: string[];
    permittedPoints?: Record<string, unknown> | string[];
    locks?: Record<string, unknown>;
    protected?: string[];
    accessibilityFloor?: string;
  };
  host?: Record<string, unknown> | null;
}

function findPreviousTheme(
  input: ResolveInput,
): Record<string, unknown> | null {
  const prev = input.previous;
  if (!prev?.id) return null;
  for (const entry of input.themes ?? []) {
    const doc = entry.document;
    if (String(doc.id ?? "") !== prev.id) continue;
    if (prev.version && String(doc.version ?? "") !== prev.version) continue;
    return doc;
  }
  return null;
}

function effectiveTextScale(
  platform: number,
  inApp: number,
  range: { min: number; max: number },
): number {
  const product = platform * inApp;
  const clamped = Math.min(range.max, Math.max(range.min, product));
  const scale = Math.max(platform, clamped);
  return Math.round(scale * 1e12) / 1e12;
}

export interface ResolvedTheme {
  applied: {
    id: string;
    version: string;
    fallback: FallbackKind;
    trust: TrustLevel;
  };
  context: EffectiveContext;
  displayText: { name: string; description?: string };
  tokens: Record<string, ResolvedTokenValue>;
  components: Record<string, unknown>;
  layout: { variants: Record<string, string> };
  preferences: Record<string, PreferenceRecord>;
  accessibility: AccessibilityReport;
  diagnostics: Diagnostic[];
}

function collectPhysicalPaths(theme: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const tokens = theme.tokens;
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return out;
  const flat = flattenTokens(tokens as Record<string, unknown>);
  for (const [path, node] of flat) {
    if (!node.isToken) continue;
    const parts = path.split(".");
    let cur: unknown = tokens;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    if (
      cur &&
      typeof cur === "object" &&
      ((cur as { physical?: unknown }).physical === true ||
        ((cur as { $extensions?: { "org.opentheme.physical"?: unknown } })
          .$extensions?.["org.opentheme.physical"] === true))
    ) {
      out.add(path);
    }
  }
  return out;
}

interface StdPoint {
  id: string;
  target?: string[] | { dimension?: string; textScale?: boolean };
}

function loadStdTargets(): Map<string, string[]> {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/customization-points.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as { points: StdPoint[] };
  const out = new Map<string, string[]>();
  for (const p of data.points ?? []) {
    if (Array.isArray(p.target)) out.set(p.id, p.target);
  }
  return out;
}

function themePointTargets(theme: Record<string, unknown>): Map<string, string[]> {
  const out = loadStdTargets();
  const cus = theme.customization as { points?: unknown } | undefined;
  const pts = cus?.points;
  if (!Array.isArray(pts)) return out;
  for (const raw of pts) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as { id?: string; target?: unknown };
    if (typeof p.id !== "string") continue;
    if (Array.isArray(p.target) && p.target.every((t) => typeof t === "string")) {
      out.set(p.id, p.target as string[]);
    }
  }
  return out;
}

/** Transitive declaration ancestors of a path (including itself). */
function ancestorClosure(
  path: string,
  decls: Map<string, Declaration>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [path];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    const d = decls.get(p);
    if (!d) continue;
    for (const ref of declarationRefs(d.value)) stack.push(ref);
  }
  return seen;
}

function preferencesAffectingFailingPairs(
  failing: AccessibilityReport["pairs"],
  decls: Map<string, Declaration>,
  prefs: Record<string, unknown>,
  prefStatus: Record<string, PreferenceRecord>,
  theme: Record<string, unknown>,
): string[] {
  const ancestors = new Set<string>();
  for (const pair of failing) {
    for (const p of ancestorClosure(pair.foreground, decls)) ancestors.add(p);
    for (const p of ancestorClosure(pair.background, decls)) ancestors.add(p);
  }
  const targets = themePointTargets(theme);
  const rejected: string[] = [];
  for (const key of Object.keys(prefs)) {
    const st = prefStatus[key];
    if (!st || st.status === "skipped" || st.status === "rejected") continue;
    const paths = targets.get(key) ?? [];
    if (paths.some((p) => ancestors.has(p))) rejected.push(key);
  }
  return rejected.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function resolveTheme(input: ResolveInput): {
  resolved: ResolvedTheme;
  diagnostics: Diagnostic[];
} {
  const collector = new DiagnosticCollector();

  const selected = selectTheme(input, collector);
  const preferences = input.preferences ?? {};
  const { context: ctxBase, preferences: prefStatus0 } = resolveContext(
    selected.document,
    input.platform,
    input.environment,
    preferences,
    input.policy,
    collector,
  );

  const previousTheme = findPreviousTheme(input);
  const floorMode = input.policy?.accessibilityFloor ?? "wcag22-aa";

  const runStages3to7 = (
    prefs: Record<string, unknown>,
    statusIn: Record<string, PreferenceRecord>,
  ): {
    ctx: EffectiveContext;
    quantized: Map<string, ResolvedTokenValue>;
    decls: Map<string, Declaration>;
    prefStatus: Record<string, PreferenceRecord>;
    components: Record<string, unknown>;
    accessibility: AccessibilityReport;
  } => {
    let decls = declareTokens(selected.document, ctxBase, input.host);
    const applied = applyPreferences(
      decls,
      {
        theme: selected.document,
        previousTheme,
        preferences: prefs,
        ...(input.policy
          ? {
              policy: {
                ...(input.policy.permittedPoints !== undefined
                  ? { permittedPoints: input.policy.permittedPoints }
                  : {}),
                ...(input.policy.protected !== undefined
                  ? { protected: input.policy.protected }
                  : {}),
              },
            }
          : {}),
        status: statusIn,
      },
      collector,
    );
    decls = applyLocks(applied.decls, input.policy?.locks, collector);

    const platformScale =
      input.platform.textScale > 0 ? input.platform.textScale : 1;
    const textScale = effectiveTextScale(
      platformScale,
      applied.inAppTextFactor,
      applied.textEffectiveRange,
    );
    const ctx: EffectiveContext = {
      ...ctxBase,
      textScale,
    };

    const overlays = applicableOverlays(selected.document, ctx);
    for (const sd of styledDeclarations(selected.document, overlays, input.host)) {
      decls.set(sd.path, { path: sd.path, type: sd.type, value: sd.value, source: "theme" });
    }
    const { values: evaluated, effort } = evaluateDeclarations(decls);
    // Styled component values and component locks are not tokens (chapter 08): they are encoded
    // without post-processing and never appear in the token output.
    const values = new Map<string, (typeof evaluated extends Map<string, infer V> ? V : never)>();
    const styledValues = new Map<string, (typeof evaluated extends Map<string, infer V> ? V : never)>();
    for (const [path, v] of evaluated) {
      if (path.startsWith("components.") || path.startsWith("lock.components.")) styledValues.set(path, v);
      else values.set(path, v);
    }
    if (effort.isExceeded) {
      collector.add({
        code: "OT-DRV-007",
        rule: "R-DRV-007",
        location: { document: "theme", pointer: "/tokens" },
        params: { detail: String(effort.total) },
      });
    }

    // Normative order: post-process, then quantize (resolution contract / R12).
    const post = postprocessValues(values, ctx, {
      physicalPaths: collectPhysicalPaths(selected.document),
      collector,
    });
    const all = quantizeAll(new Map([...post, ...styledValues]));
    const quantized = new Map<string, ResolvedTokenValue>();
    const styled = new Map<string, ResolvedTokenValue>();
    for (const [path, v] of all) (styledValues.has(path) ? styled : quantized).set(path, v);

    const components = resolveComponents(
      quantized,
      styled,
      selected.document,
      overlays,
      input.platform.forcedColors === true,
      forcedColorMap(),
      input.policy?.locks,
      input.host,
    );
    // Foreign / incompatible contract diagnostics
    const themeComponents = selected.document.components as
      | Record<string, unknown>
      | undefined;
    if (themeComponents && typeof themeComponents === "object") {
      const hostIds = new Set(
        Array.isArray(input.host?.contracts)
          ? (input.host!.contracts as { id?: string }[])
              .map((c) => c.id)
              .filter((x): x is string => typeof x === "string")
          : [],
      );
      for (const id of Object.keys(themeComponents)) {
        if (id.startsWith("std/")) continue;
        if (input.host && !hostIds.has(id)) {
          collector.add({
            code: "OT-CMP-001",
            rule: "R-CMP-001",
            location: {
              document: "theme",
              pointer: `/components/${id.replace(/~/g, "~0").replace(/\//g, "~1")}`,
            },
            params: { detail: id },
            severity: "info",
          });
        }
        const style = themeComponents[id] as Record<string, unknown>;
        const pin =
          typeof style?.contract === "string"
            ? style.contract
            : typeof style?.$version === "string"
              ? style.$version
              : undefined;
        if (pin && hostIds.has(id)) {
          const hostContract = (
            input.host!.contracts as { id: string; version: string }[]
          ).find((c) => c.id === id);
          if (hostContract) {
            const [cMaj, cMin] = hostContract.version.split(".").map(Number);
            const [pMaj, pMin] = pin.split(".").map(Number);
            if (
              pMaj !== cMaj ||
              (pMin !== undefined && cMin !== undefined && pMin > cMin)
            ) {
              collector.add({
                code: "OT-CMP-002",
                rule: "R-CMP-002",
                location: {
                  document: "theme",
                  pointer: `/components/${id.replace(/~/g, "~0").replace(/\//g, "~1")}/contract`,
                },
                params: { detail: pin },
                severity: "info",
              });
            }
          }
        }
      }
    }
    const accessibility = checkAccessibility(quantized, ctx);
    return {
      ctx,
      quantized,
      decls,
      prefStatus: applied.status,
      components,
      accessibility,
    };
  };

  let result = runStages3to7(preferences, prefStatus0);

  // Accessibility floor (FB-007): reject every user value a failing pair depends on.
  if (floorMode === "wcag22-aa") {
    const failing = result.accessibility.pairs.filter((p) => !p.pass);
    if (failing.length > 0) {
      const rejectedKeys = preferencesAffectingFailingPairs(
        failing,
        result.decls,
        preferences,
        result.prefStatus,
        selected.document,
      );
      if (rejectedKeys.length > 0) {
        const nextPrefs = { ...preferences };
        for (const key of rejectedKeys) {
          delete nextPrefs[key];
          collector.add({
            code: "OT-A11Y-007",
            rule: "R-A11Y-007",
            location: {
              document: "input",
              pointer: `/preferences/${key}`,
            },
            params: { point: key },
            severity: "warning",
          });
          result.prefStatus[key] = {
            status: "rejected",
            value: preferences[key],
          };
        }
        const statusCarry = { ...result.prefStatus };
        for (const key of rejectedKeys) {
          statusCarry[key] = {
            status: "rejected",
            value: preferences[key],
          };
        }
        result = runStages3to7(nextPrefs, statusCarry);
        for (const key of rejectedKeys) {
          result.prefStatus[key] = {
            status: "rejected",
            value: preferences[key],
          };
        }
      }
    }
  } else if (floorMode === "relaxed") {
    for (const pair of result.accessibility.pairs) {
      if (!pair.pass) {
        collector.add({
          code: "OT-A11Y-003",
          rule: "R-A11Y-003",
          location: { document: "theme", pointer: "/tokens" },
          params: {
            detail: `${pair.foreground}/${pair.background}`,
          },
          severity: "warning",
        });
      }
    }
  }

  const tokenObj: Record<string, ResolvedTokenValue> = {};
  for (const [path, v] of result.quantized) {
    tokenObj[path] = v;
  }

  const displayText = lookupDisplayText(
    selected.document,
    result.ctx.locale,
  );

  const layoutVariants = selectLayoutVariants(
    selected.document,
    result.ctx,
    input.host,
    (pointer) =>
      collector.add({
        code: "OT-LAY-001",
        rule: "R-LAY-001",
        location: { document: "theme", pointer },
        params: {},
      }),
  );

  const resolved: ResolvedTheme = {
    applied: {
      id: selected.id,
      version: selected.version,
      fallback: selected.fallback,
      trust: selected.trust,
    },
    context: result.ctx,
    displayText,
    tokens: tokenObj,
    components: result.components,
    layout: { variants: layoutVariants },
    preferences: result.prefStatus,
    accessibility: {
      ...result.accessibility,
      complete: isComplete(result.quantized),
    },
    diagnostics: [],
  };

  const diagnostics = collector.finish();
  resolved.diagnostics = diagnostics;

  return { resolved, diagnostics };
}

/** JCS bytes of a resolved theme (NFR-001). */
export function resolvedToJcs(resolved: ResolvedTheme): string {
  return canonicalize(resolved as unknown as Json);
}

export { selectTheme, loadSpecificationBaseline } from "./select.js";
export { resolveContext } from "./context.js";
export { enforcePreference } from "./enforce.js";
export { applyPreferences, isProtectedPath } from "./preferences.js";
export { lookupDisplayText, postprocessValues, postprocessTokens } from "./postprocess.js";
export { kahnOrder, evaluateDeclarations } from "./evaluate.js";
export {
  checkAccessibility,
  loadAccessibilityPairs,
  clearAccessibilityPairCache,
} from "./check.js";
