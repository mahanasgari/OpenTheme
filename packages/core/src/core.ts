/**
 * The Core entry point (contracts/public-api.md): registry, pure resolution over snapshots,
 * listing, customization description, preferences documents, and document utilities.
 */
import { jcs } from "./canonical/jcs.js";
import type { ResolvedTheme } from "./generated/types/index.js";
import { computeIntegrity } from "./canonical/integrity.js";
import { exportCheck, flattenTheme } from "./canonical/flatten.js";
import { createController, type ControllerOptions, type ThemeController } from "./controller/controller.js";
import { DiagnosticCollector, type Diagnostic } from "./diagnostics/collector.js";
import { buildModel, isRecord } from "./engine/model.js";
import { STANDARD_POINTS } from "./engine/registry.js";
import { OpenThemeCoreError, type OperationalError, operationalError } from "./errors/operational.js";
import { JsonParseError, parseIJson } from "./parse/ijson.js";
import { limit } from "./engine/registry.js";
import {
  emptyPreferences,
  parsePreferences,
  serializePreferences,
  type UserPreferencesDocument,
} from "./preferences/document.js";
import { Registry, type ThemeRegistry } from "./registry/registry.js";
import { deepFreeze, sameRef, snapshotData, type RegistryEntry, type RegistryEntryRef, type Snapshot } from "./registry/snapshot.js";
import { Lru } from "./resolve/cache.js";
import { admitted, compileInput, reachableEntries, type ResolutionRequest } from "./resolve/compile.js";
import { checkRequest } from "./resolve/context-input.js";
import { displayText, resolve as resolveInput } from "./resolve/pipeline.js";
import { effectivePoints, pointsOf } from "./resolve/preferences.js";
import { compilePolicy, type AbstractPolicy, type PolicyInput } from "./resolve/presets.js";
import { type CoreSettings, effectiveSettings, type EffectiveSettings } from "./settings.js";
import { comparePrecedence } from "./versioning/semver.js";
import { compareVersions } from "./versioning/compare.js";
import { migrateTheme, type MigrationManifest } from "./versioning/migrate.js";
import type { BaseEntry } from "./validate/theme.js";

export type Outcome = "selected" | "selected-with-adjustments" | "fallback";

export type ResolutionResult =
  | {
      readonly ok: true;
      /** The Resolved Theme (resolved-theme.schema.json), deeply frozen. */
      readonly resolved: Readonly<ResolvedTheme>;
      readonly diagnostics: readonly Diagnostic[];
      readonly outcome: Outcome;
    }
  | { readonly ok: false; readonly error: OperationalError };

export interface OperationalErrorResult {
  readonly ok: false;
  readonly error: OperationalError;
}

export interface SelectableTheme {
  readonly id: string;
  readonly version: string;
  readonly trust: "trusted" | "untrusted";
  readonly name: string;
  readonly description?: string;
  readonly colorSchemes: readonly string[];
}

export interface CustomizationPointDescription {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly localizationKey?: string;
  readonly valueType: string;
  readonly constraints: unknown;
  readonly default: unknown;
}

export interface CustomizationDescription {
  readonly themeId: string;
  readonly version: string;
  readonly points: readonly CustomizationPointDescription[];
}

export interface PreferencesDocumentApi {
  parse(bytes: Uint8Array | string): { readonly document: UserPreferencesDocument | null; readonly diagnostics: readonly Diagnostic[] };
  serialize(document: UserPreferencesDocument): string;
  empty(): UserPreferencesDocument;
}

export interface DocumentUtilities {
  canonicalize(theme: unknown): { readonly canonical: string; readonly integrity: string } | OperationalErrorResult;
  flatten(themeRef: RegistryEntryRef, snapshot: Snapshot): { readonly document: object; readonly diagnostics: readonly Diagnostic[] } | OperationalErrorResult;
  exportCheck(theme: unknown): { readonly eligible: boolean; readonly diagnostics: readonly Diagnostic[] };
  compareVersions(older: unknown, newer: unknown): {
    readonly classification: "compatible" | "breaking";
    readonly reasons: readonly { readonly kind: string; readonly detail: string; readonly pointer: string }[];
  };
  migrate(theme: unknown, manifest: unknown): { readonly document: object; readonly diagnostics: readonly Diagnostic[] };
}

export interface Core {
  readonly supported: { readonly spec: readonly string[]; readonly preferences: readonly string[] };
  readonly registry: ThemeRegistry;
  /** The current settings (frozen). */
  readonly settings: EffectiveSettings;
  /** Changes the untrusted-source or gate settings; effective from the next snapshot (FR-C027). */
  updateSettings(settings: Pick<CoreSettings, "untrustedSources" | "accessibilityGate">): void;
  resolve(snapshot: Snapshot, request: ResolutionRequest & { readonly policy: PolicyInput }): ResolutionResult;
  describeCustomization(
    snapshot: Snapshot,
    themeId: string,
    policy: PolicyInput,
    locale: string,
  ): CustomizationDescription | OperationalErrorResult;
  listSelectable(snapshot: Snapshot, policy: PolicyInput, locale: string): readonly SelectableTheme[];
  createController(options: ControllerOptions): ThemeController;
  readonly preferences: PreferencesDocumentApi;
  readonly documents: DocumentUtilities;
}

export const SUPPORTED = Object.freeze({
  spec: Object.freeze(["1.0"]),
  preferences: Object.freeze(["1.0"]),
});

function fail(kind: OperationalError["kind"], operation: string, message: string, pointer?: string): OperationalErrorResult {
  return Object.freeze({ ok: false as const, error: operationalError(kind, operation, message, pointer) });
}

function requireSnapshot(snapshot: unknown, operation: string) {
  const data = snapshotData(snapshot);
  if (!data) {
    throw new OpenThemeCoreError(operationalError("invalid-argument", operation, "The snapshot was not produced by this Core.", "/snapshot"));
  }
  return data;
}

/** RFC 4647 lookup in a `localized` map. */
function localizedRecord(localized: unknown, locale: string): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(localized)) return undefined;
  const keys = Object.keys(localized);
  for (let tag = locale; tag; ) {
    const hit = keys.find((k) => k.toLowerCase() === tag.toLowerCase());
    if (hit && isRecord(localized[hit])) return localized[hit] as Record<string, unknown>;
    const cut = tag.lastIndexOf("-");
    tag = cut > 0 ? tag.slice(0, cut) : "";
  }
  return undefined;
}

function outcomeOf(resolved: Readonly<Record<string, unknown>>): Outcome {
  const applied = resolved.applied as { fallback?: string } | undefined;
  if (applied?.fallback && applied.fallback !== "none") return "fallback";
  const prefs = isRecord(resolved.preferences) ? resolved.preferences : {};
  const adjusted = Object.values(prefs).some((p) => isRecord(p) && p.status !== "effective");
  return adjusted ? "selected-with-adjustments" : "selected";
}

function toRecord(value: unknown, operation: string, pointer: string): Readonly<Record<string, unknown>> {
  let v = value;
  if (typeof value === "string" || value instanceof Uint8Array) {
    try {
      v = parseIJson(value, { maxBytes: limit("documentBytes"), maxDepth: limit("nestingDepth") });
    } catch (e) {
      if (!(e instanceof JsonParseError)) throw e;
      throw new OpenThemeCoreError(operationalError("invalid-argument", operation, "The document is not valid I-JSON.", pointer));
    }
  }
  if (!isRecord(v)) throw new OpenThemeCoreError(operationalError("invalid-argument", operation, "The document must be a JSON object.", pointer));
  return v;
}

export function createCore(settings?: CoreSettings): Core {
  let current = effectiveSettings(settings);
  const registry = new Registry(() => current);
  const results = new Lru<ResolutionResult>(current.cache.results);

  function resolve(snapshot: Snapshot, request: ResolutionRequest & { readonly policy: PolicyInput }): ResolutionResult {
    const op = "core.resolve";
    const data = requireSnapshot(snapshot, op);
    const invalid = checkRequest(request, op);
    if (invalid) return Object.freeze({ ok: false as const, error: invalid });
    const policy = compilePolicy(request.policy, snapshot, op);
    const input = compileInput(snapshot, data, request, policy);
    // The key covers every input that can change the output (FR-C071).
    const key = jcs({
      spec: SUPPORTED.spec,
      themes: reachableEntries(snapshot, data).map((e) => [e.trust, e.integrity]),
      host: snapshot.host?.integrity ?? null,
      request: { ...request, policy },
    });
    const hit = results.get(key);
    if (hit) return hit;
    const { resolved } = resolveInput(input, registry.prepared);
    const result: ResolutionResult = deepFreeze({
      ok: true as const,
      // The pipeline's output conforms to resolved-theme.schema.json (test/api/resolved-schema.test.ts).
      resolved: resolved as unknown as ResolvedTheme,
      diagnostics: (resolved.diagnostics ?? []) as Diagnostic[],
      outcome: outcomeOf(resolved),
    });
    results.set(key, result);
    return result;
  }

  function selectable(snapshot: Snapshot, policy: AbstractPolicy): RegistryEntry[] {
    const available = new Set(policy.availableThemes ?? []);
    const trustedIds = new Set(snapshot.entries.filter((e) => e.kind === "theme" && e.trust === "trusted").map((e) => e.id));
    const out = snapshot.entries.filter(
      (e) =>
        admitted(e) &&
        e.validity === "valid" &&
        available.has(e.id) &&
        !(e.trust === "untrusted" && trustedIds.has(e.id)),
    );
    if (available.has(snapshot.baseline.id) && !trustedIds.has(snapshot.baseline.id)) out.unshift(snapshot.baseline);
    return out;
  }

  function listSelectable(snapshot: Snapshot, policy: PolicyInput, locale: string): readonly SelectableTheme[] {
    const op = "core.listSelectable";
    const data = requireSnapshot(snapshot, op);
    const abstract = compilePolicy(policy, snapshot, op);
    return deepFreeze(
      selectable(snapshot, abstract).map((e) => {
        const doc = data.documents.get(e)!;
        const text = displayText(doc, locale);
        const schemes = isRecord(doc.colorSchemes) && Array.isArray(doc.colorSchemes.supported) ? doc.colorSchemes.supported : [];
        return {
          id: e.id,
          version: e.version ?? "",
          trust: e.trust,
          name: text.name,
          ...(text.description !== undefined ? { description: text.description } : {}),
          colorSchemes: [...(schemes as string[])],
        };
      }),
    );
  }

  function describeCustomization(
    snapshot: Snapshot,
    themeId: string,
    policy: PolicyInput,
    locale: string,
  ): CustomizationDescription | OperationalErrorResult {
    const op = "core.describeCustomization";
    const data = requireSnapshot(snapshot, op);
    const abstract = compilePolicy(policy, snapshot, op);
    const candidates = selectable(snapshot, { ...abstract, availableThemes: [themeId] }).filter((e) => e.id === themeId);
    if (candidates.length === 0) return fail("unknown-theme", op, "No selectable theme has this id in the snapshot.", "/themeId");
    // Highest SemVer precedence, as an unversioned selection would choose (R-RES-005).
    const entry = candidates.reduce((a, b) => (comparePrecedence(b.version ?? "0.0.0", a.version ?? "0.0.0") > 0 ? b : a));
    const merged = data.merged.get(entry) ?? data.documents.get(entry)!;
    const model = buildModel(merged);
    const declared = pointsOf(model);
    const points = effectivePoints(model, abstract.permittedPoints, new DiagnosticCollector("input"));
    const out: CustomizationPointDescription[] = [];
    for (const p of points.values()) {
      if (p.unusable) continue;
      const decl = declared.get(p.id) ?? {};
      const std = STANDARD_POINTS.get(p.id);
      const loc = localizedRecord(decl.localized, locale);
      const label = (typeof loc?.label === "string" ? loc.label : undefined) ?? (typeof decl.label === "string" ? decl.label : std?.label) ?? p.id;
      const description =
        (typeof loc?.description === "string" ? loc.description : undefined) ??
        (typeof decl.description === "string" ? decl.description : std?.description);
      out.push({
        id: p.id,
        label,
        ...(description !== undefined ? { description } : {}),
        ...(std?.localizationKey ? { localizationKey: std.localizationKey } : {}),
        valueType: p.type,
        constraints: p.constraints ?? null,
        default: p.default ?? null,
      });
    }
    return deepFreeze({ themeId, version: entry.version ?? "", points: out });
  }

  const preferences: PreferencesDocumentApi = Object.freeze({
    parse(bytes: Uint8Array | string) {
      const { document, diagnostics } = parsePreferences(bytes);
      return deepFreeze({ document, diagnostics });
    },
    serialize: serializePreferences,
    empty: emptyPreferences,
  });

  const documents: DocumentUtilities = Object.freeze({
    canonicalize(theme: unknown) {
      const op = "documents.canonicalize";
      try {
        return computeIntegrity(toRecord(theme, op, "/theme"));
      } catch (e) {
        if (e instanceof OpenThemeCoreError) return Object.freeze({ ok: false as const, error: e.error });
        throw e;
      }
    },
    flatten(themeRef: RegistryEntryRef, snapshot: Snapshot) {
      const op = "documents.flatten";
      const data = requireSnapshot(snapshot, op);
      const entry = [snapshot.baseline, ...snapshot.entries].find((e) => e.kind === "theme" && sameRef(e, themeRef));
      if (!entry) return fail("unknown-theme", op, "The entry is not in the snapshot.", "/themeRef");
      const bases: BaseEntry[] = snapshot.entries
        .filter((e) => e.kind === "theme" && e !== entry)
        .map((e) => ({ trust: e.trust, document: data.documents.get(e)! }));
      const result = flattenTheme(data.documents.get(entry)!, bases);
      return deepFreeze({ document: result.document ?? {}, diagnostics: result.diagnostics });
    },
    exportCheck(theme: unknown) {
      return deepFreeze(exportCheck(toRecord(theme, "documents.exportCheck", "/theme")));
    },
    compareVersions(older: unknown, newer: unknown) {
      const op = "documents.compareVersions";
      return deepFreeze(compareVersions(toRecord(older, op, "/older"), toRecord(newer, op, "/newer")));
    },
    migrate(theme: unknown, manifest: unknown) {
      const op = "documents.migrate";
      const m = toRecord(manifest, op, "/manifest");
      if (typeof m.from !== "string" || typeof m.to !== "string" || !Array.isArray(m.operations)) {
        throw new OpenThemeCoreError(operationalError("invalid-argument", op, "The manifest needs from, to, and operations.", "/manifest"));
      }
      const r = migrateTheme(toRecord(theme, op, "/theme"), m as unknown as MigrationManifest);
      return deepFreeze({ document: r.document, diagnostics: r.diagnostics });
    },
  });

  const core: Core = {
    supported: SUPPORTED,
    registry,
    get settings() {
      return current;
    },
    updateSettings(next) {
      if (!isRecord(next)) {
        throw new OpenThemeCoreError(operationalError("invalid-argument", "core.updateSettings", "Settings must be an object."));
      }
      for (const k of Object.keys(next)) {
        if (k !== "untrustedSources" && k !== "accessibilityGate") {
          throw new OpenThemeCoreError(
            operationalError("invalid-argument", "core.updateSettings", "Only untrustedSources and accessibilityGate can change.", `/${k}`),
          );
        }
      }
      current = effectiveSettings(next, current, "core.updateSettings");
      registry.settingsChanged();
    },
    resolve,
    describeCustomization,
    listSelectable,
    createController: (options) => createController(core, options),
    preferences,
    documents,
  };
  return Object.freeze(core);
}
