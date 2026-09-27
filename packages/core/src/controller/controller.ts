/**
 * The Theme Controller (FR-C080 to FR-C082, FR-C090 to FR-C093; data-model §10): one scope's
 * snapshot, policy, context, and User Preferences document, publishing the pure resolution of
 * those inputs. Enforcement never writes; only explicit user intent does.
 */
import { jcs } from "../canonical/jcs.js";
import type { Core, ResolutionResult } from "../core.js";
import type { Diagnostic } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";
import { OpenThemeCoreError, type OperationalError, operationalError } from "../errors/operational.js";
import { compilePreferences } from "../preferences/compile.js";
import {
  emptyPreferences,
  isPermittedLiteral,
  parsePreferences,
  serializePreferences,
  type UserPreferencesDocument,
} from "../preferences/document.js";
import type { Json } from "../parse/ijson.js";
import type { Snapshot } from "../registry/snapshot.js";
import { checkContext } from "../resolve/context-input.js";
import type { ResolutionRequest } from "../resolve/compile.js";
import { isPreset, type PolicyInput } from "../resolve/presets.js";
import { BASELINE_ID } from "../resolve/select.js";
import { applyPreview, type PreviewChange } from "./preview.js";
import type { PreferenceStore } from "./store.js";

export interface ControllerContext {
  readonly platform: ResolutionRequest["platform"];
  readonly environment: ResolutionRequest["environment"];
}

export interface ControllerOptions {
  readonly policy: PolicyInput;
  readonly context: ControllerContext;
  /** Synchronous initial state, for example read during server rendering (FR-C092). */
  readonly initial?: Uint8Array | string | UserPreferencesDocument;
  readonly store?: PreferenceStore;
  readonly scope?: string;
  /** The snapshot to start from; defaults to the registry's current snapshot. */
  readonly snapshot?: Snapshot;
}

type Ok = ResolutionResult & { readonly ok: true };

export interface ThemeController {
  readonly current: Ok;
  subscribe(listener: (result: Ok) => void): () => void;
  setContext(ctx: Partial<ControllerContext>): void;
  setPolicy(policy: PolicyInput): void;
  setSnapshot(snapshot: Snapshot): void;
  select(selection: { id: string; version?: string }): Promise<void>;
  setValue(pointId: string, value: unknown): Promise<void>;
  clearValue(pointId: string): Promise<void>;
  reset(): Promise<void>;
  preview(change: PreviewChange): void;
  acceptPreview(): Promise<void>;
  cancelPreview(): void;
  exportDocument(): string;
  importDocument(bytes: Uint8Array | string): Promise<{ imported: boolean; diagnostics: readonly Diagnostic[] }>;
  readonly errors: readonly OperationalError[];
  dispose(): void;
}

const POINT_ID = /^(?:std\.)?[a-z][a-z0-9-]*$/;

function usableDocument(input: unknown): UserPreferencesDocument | null {
  const parsed = parsePreferences(input);
  return parsed.document;
}

function defaultThemeOf(policy: PolicyInput): string {
  if (isPreset(policy)) return policy.defaultTheme;
  return typeof policy.defaultTheme === "string" ? policy.defaultTheme : BASELINE_ID;
}

export function createController(core: Core, options: ControllerOptions): ThemeController {
  const op = (name: string) => `controller.${name}`;
  if (!isRecord(options)) {
    throw new OpenThemeCoreError(operationalError("invalid-argument", op("create"), "Controller options must be an object."));
  }
  const badContext = checkContext(options.context?.platform, options.context?.environment, op("create"));
  if (badContext) throw new OpenThemeCoreError(badContext);

  const scope = options.scope ?? "default";
  const store = options.store;
  let snapshot = options.snapshot ?? core.registry.snapshot();
  let policy = options.policy;
  let context: ControllerContext = { platform: { ...options.context.platform }, environment: { ...options.context.environment } };
  let prefs: UserPreferencesDocument =
    options.initial !== undefined ? (usableDocument(options.initial) ?? emptyPreferences()) : emptyPreferences();
  let preview: PreviewChange | null = null;
  let generation = 0;
  let disposed = false;
  const errors: OperationalError[] = [];
  const listeners = new Set<(result: Ok) => void>();

  const compute = (): Ok => {
    const effective = applyPreview(prefs, preview);
    const compiled = compilePreferences(effective, defaultThemeOf(policy));
    const result = core.resolve(snapshot, { ...compiled, ...context, policy });
    if (!result.ok) throw new OpenThemeCoreError(result.error);
    return result;
  };

  let published = compute();
  let publishedBytes = jcs(published.resolved);

  /** Resolve, record `previous` for an applied non-fallback selection, and notify on change. */
  const refresh = (): void => {
    const next = compute();
    const applied = next.resolved.applied as { id: string; version: string; fallback: string };
    if (!preview && applied.fallback === "none" && applied.id !== BASELINE_ID) {
      const prev = prefs.previous;
      if (!prev || prev.id !== applied.id || prev.version !== applied.version) {
        prefs = { ...prefs, previous: { id: applied.id, version: applied.version } };
      }
    }
    const bytes = jcs(next.resolved);
    published = next;
    if (bytes === publishedBytes) return;
    publishedBytes = bytes;
    for (const l of [...listeners]) l(next);
  };

  const live = (name: string) => {
    if (disposed) throw new OpenThemeCoreError(operationalError("disposed", op(name), "The controller was disposed."));
  };

  /** Persist the current document once; failures are reported, never applied (FB-C002). */
  const write = async (name: string): Promise<void> => {
    if (!store) return;
    try {
      await store.write(scope, serializePreferences(prefs));
    } catch {
      errors.push(operationalError("store-write-failed", op(name), "The preference store failed to write."));
    }
  };

  const commit = async (name: string, next: UserPreferencesDocument): Promise<void> => {
    generation += 1;
    prefs = next;
    refresh();
    await write(name);
  };

  // Stored state arrives asynchronously; a user change in the meantime supersedes it (FB-C004).
  if (store && options.initial === undefined) {
    const started = generation;
    void (async () => {
      let bytes: Uint8Array | string | null;
      try {
        bytes = await store.read(scope);
      } catch {
        errors.push(operationalError("store-read-failed", op("create"), "The preference store failed to read."));
        return;
      }
      if (disposed || bytes === null) return;
      if (generation !== started) {
        errors.push(operationalError("superseded", op("create"), "Stored preferences arrived after a newer change."));
        return;
      }
      const stored = usableDocument(bytes);
      // A newer or invalid stored document is unavailable and never overwritten (FB-C003).
      if (!stored) return;
      prefs = stored;
      refresh();
    })();
  }

  const controller: ThemeController = {
    get current() {
      return published;
    },
    get errors() {
      return Object.freeze([...errors]);
    },
    subscribe(listener) {
      live("subscribe");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setContext(ctx) {
      live("setContext");
      const next = {
        platform: { ...context.platform, ...(ctx.platform ?? {}) },
        environment: { ...context.environment, ...(ctx.environment ?? {}) },
      };
      const bad = checkContext(next.platform, next.environment, op("setContext"));
      if (bad) throw new OpenThemeCoreError(bad);
      context = next;
      refresh();
    },
    setPolicy(next) {
      live("setPolicy");
      policy = next;
      refresh();
    },
    setSnapshot(next) {
      live("setSnapshot");
      snapshot = next;
      refresh();
    },
    async select(selection) {
      live("select");
      if (!isRecord(selection) || typeof selection.id !== "string") {
        throw new OpenThemeCoreError(operationalError("invalid-argument", op("select"), "selection must be { id, version? }.", "/selection"));
      }
      const sel = { id: selection.id, ...(typeof selection.version === "string" ? { version: selection.version } : {}) };
      await commit("select", { ...prefs, selection: sel });
    },
    async setValue(pointId, value) {
      live("setValue");
      if (typeof pointId !== "string" || pointId.length > 64 || !POINT_ID.test(pointId)) {
        throw new OpenThemeCoreError(operationalError("invalid-argument", op("setValue"), "The point id is not valid.", "/pointId"));
      }
      if (!isPermittedLiteral(value)) {
        throw new OpenThemeCoreError(operationalError("invalid-argument", op("setValue"), "The value is not a permitted literal.", "/value"));
      }
      await commit("setValue", { ...prefs, values: { ...prefs.values, [pointId]: value as Json } });
    },
    async clearValue(pointId) {
      live("clearValue");
      const { [pointId]: _removed, ...rest } = prefs.values;
      await commit("clearValue", { ...prefs, values: rest });
    },
    async reset() {
      live("reset");
      preview = null;
      await commit("reset", { ...prefs, selection: null, values: {} });
    },
    preview(change) {
      live("preview");
      if (!isRecord(change)) {
        throw new OpenThemeCoreError(operationalError("invalid-argument", op("preview"), "The preview change must be an object."));
      }
      for (const [k, v] of Object.entries(change.values ?? {})) {
        if (!POINT_ID.test(k) || !isPermittedLiteral(v)) {
          throw new OpenThemeCoreError(operationalError("invalid-argument", op("preview"), "A preview value is not valid.", `/values/${k}`));
        }
      }
      preview = { ...change };
      refresh();
    },
    async acceptPreview() {
      live("acceptPreview");
      if (!preview) return;
      const next = applyPreview(prefs, preview);
      preview = null;
      await commit("acceptPreview", next);
    },
    cancelPreview() {
      live("cancelPreview");
      if (!preview) return;
      preview = null;
      refresh();
    },
    exportDocument() {
      live("exportDocument");
      return serializePreferences(prefs);
    },
    async importDocument(bytes) {
      live("importDocument");
      const parsed = parsePreferences(bytes);
      if (!parsed.document) return { imported: false, diagnostics: parsed.diagnostics };
      preview = null;
      await commit("importDocument", parsed.document);
      return { imported: true, diagnostics: parsed.diagnostics };
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
  return Object.freeze(controller);
}
