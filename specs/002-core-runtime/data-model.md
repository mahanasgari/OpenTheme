# Data Model: OpenTheme Core Runtime

**Feature**: `002-core-runtime` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Core introduces no theme-level data. Theme documents, host declarations, the resolution input,
the Resolved Theme, and diagnostics are defined by the Foundation and are referenced here, never
restated. This file defines only the runtime entities Core adds, plus the new User Preferences
document.

| Foundation entity | Normative source | Core's use |
|---|---|---|
| Theme document | `theme.schema.json`, chapters 01–09, 15 | Admitted, never modified |
| Host declaration | `host-declaration.schema.json`, chapter 17 | Admitted, at most one active |
| Resolution input | `resolution-input.schema.json`, `contracts/resolution.md` | Compiled from a snapshot plus a request |
| Resolved Theme | `resolved-theme.schema.json` | Returned unchanged, deeply frozen |
| Diagnostic | `diagnostic.schema.json`, chapter 13, `diagnostics.json` | Returned unchanged |

## 1. CoreSettings

Host-level configuration, fixed when a Core instance is created. It is not part of the
resolution input (FR-C024, FR-C028; research CR13).

| Field | Type | Default | Rule |
|---|---|---|---|
| `untrustedSources.user-created` | boolean | `false` | FR-C024 |
| `untrustedSources.imported` | boolean | `false` | FR-C024 |
| `untrustedSources.shared` | boolean | `false` | FR-C024 |
| `untrustedSources.ai-generated` | boolean | `false` | FR-C024 |
| `accessibilityGate` | `"enforce"` \| `"relaxed"` | `"enforce"` | FR-C028 |
| `registryCapacity` | integer ≥ 1 | 256 | FR-C074 |
| `cache.preparedThemes` | integer ≥ 0 | 16 | FR-C072 (0 disables) |
| `cache.results` | integer ≥ 0 | 32 | FR-C072 (0 disables) |

Validation: unknown fields or out-of-range values produce an `invalid-argument` operational
error when the instance is created. There is no setting that changes a specification limit
(FR-C011).

## 2. Admission request and result

**AdmissionRequest**

| Field | Type | Rule |
|---|---|---|
| `kind` | `"theme"` \| `"host"` | FR-C014 |
| `bytes` | UTF-8 bytes or string | Size is checked before decoding (research CR3) |
| `trust` | `"trusted"` \| `"untrusted"` | Required; no default (FR-C020) |
| `source` | Untrusted Source Category | Required if and only if `trust` is `untrusted` (FR-C026) |

**AdmissionResult**

| Field | Type | Notes |
|---|---|---|
| `status` | `"registered"` \| `"already-registered"` \| `"invalid"` \| `"refused"` | `invalid` is registered for reporting but never selectable (FR-C033). `refused` is not registered |
| `entry` | RegistryEntry or `null` | `null` when `refused` |
| `diagnostics` | Diagnostic[] | Chapter 13 order and cap |
| `error` | OperationalError or `null` | Set when `refused` (FR-C083) |

## 3. Untrusted Source Category

`"user-created" | "imported" | "shared" | "ai-generated"`. Supplied by the host; never derived
from `provenance` (FR-C026). Trusted admissions carry no category.

## 4. RegistryEntry

| Field | Type | Notes |
|---|---|---|
| `kind` | `"theme"` \| `"host"` | |
| `id`, `version` | string | From the document; identity only, never trust (FR-C021) |
| `integrity` | string | Canonical integrity (research R3) |
| `trust` | `"trusted"` \| `"untrusted"` | From the admission (FR-C020) |
| `source` | Untrusted Source Category \| `null` | |
| `validity` | `"valid"` \| `"invalid"` \| `"unsupported"` | Admission-time; recomputed per snapshot when bases or host change (FR-C041) |
| `gate` | `"pass"` \| `"refused-accessibility"` \| `"refused-source"` \| `"not-applicable"` | Recomputed with validity (FR-C027, FR-C028) |
| `diagnostics` | Diagnostic[] | Admission-time |

Identity: `(kind, trust, id, version, integrity)`. Admitting an identical tuple again returns
`already-registered` (Edge Cases). The same `(id, version)` with different integrity is kept as a
distinct entry and flagged per chapter 12.

## 5. Snapshot

An immutable view that resolution uses (FR-C032).

| Field | Type | Notes |
|---|---|---|
| `sequence` | integer | Monotonic per registry; not a clock |
| `entries` | RegistryEntry[] | Canonical order: trust (trusted first), id, version precedence, integrity |
| `host` | RegistryEntry \| `null` | |
| `baseline` | built-in | Specification baseline for each supported specification version; always trusted (FR-C022) |

**Selectable** (FR-C042, FR-C027): `validity = valid`, `gate ∈ {pass, not-applicable}`, not
shadowing a trusted entry, and present in the policy's `availableThemes`.

## 6. Resolution Request

The runtime inputs that, with a snapshot, compile losslessly into the Foundation's resolution
input (FR-C070).

| Field | Type | Maps to |
|---|---|---|
| `selection` | `{ id, version? }` | `selection` |
| `previous` | `{ id, version }` \| `null` | `previous` |
| `platform` | PlatformContext | `platform` |
| `environment` | EnvironmentContext | `environment` |
| `preferences` | point id → literal | `preferences` |
| `policy` | abstract policy or Policy Preset | `policy` |

The snapshot compiles to `themes: [{ trust, document }]` (selectable entries plus the bases they
reach) and `host`. Trusted entries are listed before untrusted ones (F1 errata).

**PlatformContext**: `colorScheme` (`light` \| `dark` \| `no-preference`), `contrast`
(`standard` \| `high`), `forcedColors` (boolean), `reducedMotion` (boolean), `textScale`
(number > 0). **EnvironmentContext**: `sizeClass` (`compact` \| `medium` \| `expanded`),
`locale` (BCP 47), `direction` (`ltr` \| `rtl`). These mirror the schema exactly (FR-C050). Core
accepts no density or pixel-width input (FR-C051, FR-C052). Invalid values produce an
`invalid-context` operational error.

## 7. Policy Preset

`"closed"` (default) or `"common-personalization"` (research CR14). Frozen data that compiles
to the abstract policy. A preset takes `defaultTheme` from the host.

## 8. User Preferences Document (new contract)

Format, limits, and diagnostics: [contracts/user-preferences-document.md](./contracts/user-preferences-document.md).

| Field | Type | Required |
|---|---|---|
| `openthemePreferences` | `"MAJOR.MINOR"` | yes |
| `selection` | `{ id, version? }` \| `null` | yes |
| `previous` | `{ id, version }` \| `null` | yes |
| `values` | point id → literal | yes (may be empty) |
| `$extensions` | reverse-domain key → any JSON | no; preserved, not interpreted |

**Compile** to the Resolution Request: `selection` (or the policy default when `null`),
`previous`, and `preferences` = `values` without the entries flagged `OT-PREF-008`. Compiling
never changes the stored document (FR-C063).

## 9. Preference Store

| Operation | Input | Output |
|---|---|---|
| `read(scope)` | scope key (host-chosen string) | document bytes \| `null`; may be asynchronous |
| `write(scope, bytes)` | canonical document bytes | done; may be asynchronous |
| `clear(scope)` | scope key | done |

Failures surface as `store-read-failed` / `store-write-failed` operational errors (FB-C002). Core
ships `createMemoryStore()` only (FR-C091).

## 10. Theme Controller state

| Field | Notes |
|---|---|
| `snapshot` | Current registry snapshot |
| `policy` | Abstract policy or preset |
| `context` | PlatformContext and EnvironmentContext |
| `document` | Current User Preferences document (in memory; source of truth for this scope) |
| `preview` | Optional pending `{ selection?, values? }`; never persisted |
| `published` | Last published Resolved Theme (frozen) |
| `generation` | Counter for asynchronous completions (FB-C004) |

**State transitions**

```text
            setContext / setPolicy / snapshot change
   ┌──────────────────────────────────────────────────────┐
   ▼                                                      │
[Idle(published R)] ──select / setValue / reset──▶ write document ──▶ resolve ──▶ publish if bytes ≠ R
   │                                                      ▲
   ├──preview(p)──▶ [Previewing(R, p)] ──accept──▶ commit p to document, write once ──┘
   │                         │
   │                         └──cancel──▶ [Idle(R)] (R restored exactly, nothing written)
   └──store read completes (generation current) ──▶ replace document if valid ──▶ resolve
```

- `previous` is updated only when a resolution applies the selection with `fallback: "none"`
  (FR-C082).
- Enforcement results (clamped, fell back, skipped, rejected) never change `document`
  (FR-C063).
- `importDocument(bytes)` replaces `document` and writes once only when the imported document is
  usable; otherwise nothing changes (FR-C068). `exportDocument()` returns `document` as canonical
  bytes.

## 11. Operational Error

`{ kind, operation, pointer?, message, hint, docs }`. The closed kind list is in
[contracts/operational-errors.md](./contracts/operational-errors.md). Parameters carry no
untrusted document text (FR-C086).

## 12. Relationships

```text
CoreSettings 1──* Registry 1──* RegistryEntry
Registry 1──* Snapshot (immutable, sequence-numbered)
Snapshot + ResolutionRequest ──compile──▶ Foundation resolution input ──resolve──▶ Resolved Theme
UserPreferencesDocument ──compile──▶ ResolutionRequest.{selection, previous, preferences}
ThemeController 1──1 Snapshot (current), 0..1 PreferenceStore, 1 UserPreferencesDocument
```
