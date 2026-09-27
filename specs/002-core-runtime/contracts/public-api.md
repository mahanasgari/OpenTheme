# Contract: `@opentheme/core` Public API

**Version**: 0.1.0 (pre-release; FR-C103) | **Spec**: [../spec.md](../spec.md) |
**Data model**: [../data-model.md](../data-model.md)

Signatures are TypeScript declarations for precision. Every type named `Theme…`, `Host…`,
`ResolvedTheme`, and `Diagnostic` is generated from the Foundation schemas (FR-C104). The API is
synchronous unless marked `Promise`. Nothing below touches files, network, clocks, randomness,
DOM, or storage.

## Entry point

```ts
export function createCore(settings?: CoreSettings): Core;

export interface Core {
  readonly supported: { spec: readonly string[]; preferences: readonly string[] };
  readonly registry: ThemeRegistry;
  readonly settings: EffectiveSettings;                       // current, frozen
  // Changes the untrusted-source or gate settings from the next snapshot on (FR-C027). Any other
  // member is `invalid-argument`: capacity and cache bounds are fixed at creation.
  updateSettings(settings: Pick<CoreSettings, "untrustedSources" | "accessibilityGate">): void;
  resolve(snapshot: Snapshot, request: ResolutionRequest): ResolutionResult;
  describeCustomization(snapshot: Snapshot, themeId: string, policy: PolicyInput, locale: string):
    CustomizationDescription | OperationalErrorResult;
  listSelectable(snapshot: Snapshot, policy: PolicyInput, locale: string): SelectableTheme[];
  createController(options: ControllerOptions): ThemeController;
  readonly preferences: PreferencesDocumentApi;
  readonly documents: DocumentUtilities;
}
```

## ThemeRegistry (FR-C010 to FR-C015, FR-C020 to FR-C034)

```ts
export interface ThemeRegistry {
  admit(request: AdmissionRequest): AdmissionResult;           // sync; bytes already obtained
  admitFrom(source: ThemeSource, request: Omit<AdmissionRequest, "bytes">):
    Promise<AdmissionResult>;                                  // host I/O through the source
  remove(entry: RegistryEntryRef): Snapshot;
  snapshot(): Snapshot;                                        // immutable
}
export interface ThemeSource { load(): Promise<Uint8Array | string> }   // host-implemented
```

| Aspect | Contract |
|---|---|
| Invariants | Trust is required and never inferred. Untrusted admissions need an allowed `source`. The baseline is always present. Identity rules follow chapter 12 with per-document trust |
| Failure | Refusals return `status: "refused"` with an OperationalError. Invalid documents return `status: "invalid"` with diagnostics and are never selectable |
| Determinism | The same bytes, trust, source, settings, and registry contents give the same result and diagnostics |
| Order of checks | trust/source → size → parse → identity (`already-registered`) → capacity → validate → accessibility gate (untrusted only). `admitFrom` checks trust and source before calling `load()` |
| Previous major | `AdmissionRequest.migration` (a `MigrationManifest`) admits a theme of the previous specification major through migration, keeping the admission's trust, with `OT-VER-003`/`OT-VER-004` (FR-C101). It applies only across exactly one major |
| Entries | `version` is `null` for host declarations. Bytes that are not a JSON object have no identity: the result is `invalid` with `entry: null` and the diagnostics |

## resolve (FR-C070 to FR-C073)

```ts
export interface ResolutionRequest {
  selection: { id: string; version?: string };
  previous: { id: string; version: string } | null;
  platform: PlatformContext;
  environment: EnvironmentContext;
  preferences: Readonly<Record<string, unknown>>;
  policy: PolicyInput;                      // AbstractPolicy | { preset: PresetName; defaultTheme: string }
}
export type ResolutionResult =
  | { ok: true; resolved: ResolvedTheme; diagnostics: readonly Diagnostic[];
      outcome: "selected" | "selected-with-adjustments" | "fallback" }   // FR-C087
  | { ok: false; error: OperationalError };                           // invalid request only
```

| Aspect | Contract |
|---|---|
| Semantics | Identical to the Foundation resolution of the compiled input (chapter 10) |
| Output | `resolved` conforms to `resolved-theme.schema.json` and is deeply frozen |
| Failure | Theme problems never produce `ok: false`; they produce a fallback. `ok: false` only for caller errors such as `invalid-context` |
| Determinism | Byte-identical JCS output for identical inputs, whatever the cache state (FR-C071) |
| Performance | NFR-C001 |

## Controller (FR-C080 to FR-C082, FR-C090 to FR-C093)

```ts
export interface ControllerOptions {
  policy: PolicyInput;
  context: { platform: PlatformContext; environment: EnvironmentContext };
  initial?: Uint8Array | string | UserPreferencesDocument;  // synchronous first paint (FR-C092)
  store?: PreferenceStore; scope?: string;                    // optional persistence
  snapshot?: Snapshot;                                        // default: registry.snapshot()
}
export interface ThemeController {
  readonly current: ResolutionResult & { ok: true };
  subscribe(listener: (result: ResolutionResult & { ok: true }) => void): () => void;
  setContext(ctx: Partial<ControllerOptions["context"]>): void;
  setPolicy(policy: PolicyInput): void;
  setSnapshot(snapshot: Snapshot): void;
  select(selection: { id: string; version?: string }): Promise<void>;   // writes store
  setValue(pointId: string, value: unknown): Promise<void>;           // writes store
  clearValue(pointId: string): Promise<void>;
  reset(): Promise<void>;                                             // developer default, no values
  preview(change: { selection?: { id: string; version?: string };
                    values?: Record<string, unknown> }): void;        // never writes
  acceptPreview(): Promise<void>;
  cancelPreview(): void;
  exportDocument(): string;                                           // canonical JCS bytes (FR-C068)
  importDocument(bytes: Uint8Array | string): Promise<{
    imported: boolean; diagnostics: readonly Diagnostic[] }>;          // writes once if usable
  readonly errors: readonly OperationalError[];                       // e.g. store failures
  dispose(): void;
}
export interface PreferenceStore {
  read(scope: string): Promise<Uint8Array | string | null> | Uint8Array | string | null;
  write(scope: string, bytes: string): Promise<void> | void;
  clear(scope: string): Promise<void> | void;
}
export function createMemoryStore(): PreferenceStore;
```

| Aspect | Contract |
|---|---|
| Invariants | `current` always equals `core.resolve(snapshot, compiled request)`. Enforcement never writes. Only `select`, `setValue`, `clearValue`, `reset`, `acceptPreview`, and a successful `importDocument` write |
| Export and import | `exportDocument` returns the current document's canonical bytes; it never includes theme, policy, or host data. `importDocument` parses with the same validation as stored data (`OT-PREF-*`). If the document is usable, it replaces the current document, is written once, and triggers a resolution. Otherwise `imported: false`, the diagnostics are returned, and the current document and the store are unchanged. A preview in progress is cancelled by a successful import |
| Notifications | Exactly one per change whose output bytes differ, delivered synchronously after commit |
| Failure | Store failures are appended to `errors` and never change the applied result. A stale asynchronous completion is discarded (FB-C004). Invalid context in `createController` or `setContext` throws `invalid-context`; an invalid `setValue` or `preview` value throws `invalid-argument` |

## Customization and theme listing (FR-C042, FR-C066)

```ts
export interface SelectableTheme { id: string; version: string; trust: "trusted" | "untrusted";
  name: string; description?: string; colorSchemes: readonly string[] }
export interface CustomizationDescription { themeId: string; version: string; points: readonly {
  id: string; label: string; description?: string; localizationKey?: string; valueType: string;
  constraints: unknown /* effective, after policy narrowing */; default: unknown }[] }
```

## User Preferences documents (FR-C067 to FR-C069)

```ts
export interface PreferencesDocumentApi {
  parse(bytes: Uint8Array | string): { document: UserPreferencesDocument | null;
    diagnostics: readonly Diagnostic[] };          // OT-PREF-* ; migrates older 1.x
  serialize(document: UserPreferencesDocument): string;   // canonical JCS bytes
  empty(): UserPreferencesDocument;
}
```

## Document utilities (FR-C110)

```ts
export interface DocumentUtilities {
  canonicalize(theme: unknown): { canonical: string; integrity: string } | OperationalErrorResult;
  flatten(themeRef: RegistryEntryRef, snapshot: Snapshot): { document: object;
    diagnostics: readonly Diagnostic[] };
  exportCheck(theme: unknown): { eligible: boolean; diagnostics: readonly Diagnostic[] };
  compareVersions(older: unknown, newer: unknown): { classification: "compatible" | "breaking";
    reasons: readonly { kind: string; detail: string; pointer: string }[] };
  migrate(theme: unknown, manifest: unknown): { document: object;
    diagnostics: readonly Diagnostic[] };
}
```

These follow the Foundation's runner-protocol semantics exactly (contracts/conformance.md).

## Versioning of this API (FR-C102)

- SemVer, independent of the specification. `0.x` until the specification is `1.0.0` final.
- A major bump is required for removing an export, changing a signature incompatibly, dropping
  a specification or preferences major, or removing an operational error kind.
- Adding exports, optional fields, operational error kinds, or support for a new specification
  minor is a minor bump.
- Deprecations are announced one minor ahead and reported through a `deprecated-api` operational
  warning while in effect.

## Explicitly not exported

Numeric kernels, parser internals, cache controls beyond `CoreSettings.cache`, prepared-theme
structures, and anything framework-, DOM-, or platform-specific.
