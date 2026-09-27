# Contract: Core Operational Errors

**Spec**: FR-C083 | **Versioned with**: the `@opentheme/core` public API (FR-C102)

Operational errors report failures that are not findings about a document. They are never
`OT-` diagnostics, never change validity, and never change the applied appearance.

## Shape

```json
{
  "kind": "source-not-allowed",
  "operation": "registry.admit",
  "pointer": "/source",
  "message": "Untrusted themes from source \"imported\" are not allowed.",
  "hint": "Enable settings.untrustedSources.imported if this host accepts imported themes.",
  "docs": "https://opentheme.org/core/errors/source-not-allowed"
}
```

| Field | Rule |
|---|---|
| `kind` | One of the closed kinds below: kebab-case, never starts with `OT-` |
| `operation` | The public operation that reported it, for example `registry.admit` or `controller.select` |
| `pointer` | JSON Pointer into the caller's argument, when one applies |
| `message`, `hint` | English defaults. `kind` is the stable key for localization |
| `docs` | A stable documentation URL (constitution XI). Core never fetches it |

Operational errors never include untrusted document content (FR-C086).

## Kinds (closed set for Core 0.1)

| Kind | When | Where it surfaces |
|---|---|---|
| `trust-missing` | Admission without `trust` (FB-C001) | `AdmissionResult.error` |
| `source-missing` | Untrusted admission without `source` | `AdmissionResult.error` |
| `source-unknown` | `source` is not a known category | `AdmissionResult.error` |
| `source-not-allowed` | Category disabled in settings (FB-C005) | `AdmissionResult.error` |
| `accessibility-gate` | Untrusted theme below AA with the gate on (FB-C007); the `OT-A11Y-003` diagnostics accompany it | `AdmissionResult.error` |
| `registry-capacity` | `registryCapacity` reached | `AdmissionResult.error` |
| `source-load-failed` | `ThemeSource.load()` rejected | `admitFrom` result |
| `superseded` | An asynchronous completion arrived after a newer generation (FB-C004) | Controller `errors` (informational) |
| `store-read-failed` / `store-write-failed` | The Preference Store threw or rejected (FB-C002) | Controller `errors` |
| `invalid-context` | Platform or environment value outside the schema | `ResolutionResult` (`ok: false`) |
| `invalid-argument` | Any other malformed argument or setting | Result or thrown |
| `unknown-theme` | Describe or flatten on an id that is not in the snapshot | Result |
| `unknown-preset` | Unknown preset name | Result or thrown |
| `disposed` | Call on a disposed controller | Thrown |
| `deprecated-api` | Use of a deprecated export (warning) | Controller `errors` / return value |

**Thrown versus returned**: data-dependent refusals are returned. Only programming errors
against the typed API (`invalid-argument` on wrong types, `unknown-preset`, `disposed`) are
thrown, as an `OpenThemeCoreError` carrying the same payload.

**Evolution**: adding a kind is a minor change. Removing or renaming one is a major change.
