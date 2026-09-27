/**
 * @opentheme/core — public API (specs/002-core-runtime/contracts/public-api.md).
 * Only the exports listed in the contract are public.
 */
export {
  createCore,
  SUPPORTED,
  type Core,
  type CustomizationDescription,
  type CustomizationPointDescription,
  type DocumentUtilities,
  type OperationalErrorResult,
  type Outcome,
  type PreferencesDocumentApi,
  type ResolutionResult,
  type SelectableTheme,
} from "./core.js";
export type { AdmissionRequest, AdmissionResult, ThemeRegistry, ThemeSource } from "./registry/registry.js";
export type { EntryKind, RegistryEntry, RegistryEntryRef, Snapshot, Validity } from "./registry/snapshot.js";
export type { Gate } from "./admission/a11y-gate.js";
export type { Trust } from "./admission/sources.js";
export type { ResolutionRequest } from "./resolve/compile.js";
export { PRESETS, type AbstractPolicy, type PolicyInput, type PresetName, type PresetPolicy } from "./resolve/presets.js";
export type { ControllerContext, ControllerOptions, ThemeController } from "./controller/controller.js";
export type { PreviewChange } from "./controller/preview.js";
export { createMemoryStore, type PreferenceStore } from "./controller/store.js";
export type { UserPreferencesDocument } from "./preferences/document.js";
export {
  OPERATIONAL_ERROR_KINDS,
  OpenThemeCoreError,
  type OperationalError,
  type OperationalErrorKind,
} from "./errors/operational.js";
export type { CoreSettings, EffectiveSettings, UntrustedSource } from "./settings.js";
export type { Diagnostic, DiagnosticLocation, Severity } from "./diagnostics/collector.js";
export type { ResolvedTheme, UserPreferences, ResolutionInput } from "./generated/types/index.js";
export type { MigrationManifest } from "./versioning/migrate.js";
