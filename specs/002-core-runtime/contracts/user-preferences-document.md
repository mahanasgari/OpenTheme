# Contract: User Preferences Document 1.0

**Status**: Proposed new public contract (Foundation prerequisite P3). **Normative sources after
implementation**: `specification/spec/18-user-preferences.md`,
`specification/schemas/user-preferences/1.0/user-preferences.schema.json`, the `PREF` entries in
`specification/registry/1.0/diagnostics.json` and `rules.json`, and fixtures under
`conformance/fixtures/preferences/`. **Spec**: FR-C067 to FR-C069.

A User Preferences document stores one scope's personalization separately from every theme
(constitution II). It adds to the Foundation and changes none of its existing artifacts.

## Example

```json
{
  "openthemePreferences": "1.0",
  "selection": { "id": "org.opentheme.aurora" },
  "previous": { "id": "org.opentheme.aurora", "version": "1.0.0" },
  "values": {
    "std.accent": { "colorSpace": "srgb", "components": [0.9, 0.3, 0.1] },
    "std.text-size": 1.2,
    "std.color-scheme": "dark"
  }
}
```

## Members

| Member | Rule |
|---|---|
| `openthemePreferences` | Required. `MAJOR.MINOR`. A reader of 1.N accepts 1.0–1.N. A newer minor or another major is unsupported (`OT-PREF-004`), except a previous major inside its deprecation window, which is migrated (`OT-PREF-009` for lossy changes) |
| `selection` | Required. `null` or `{ id, version? }`, where `id` uses the theme identifier grammar (research R5) and `version` is SemVer |
| `previous` | Required. `null` or `{ id, version }`, the last theme applied without fallback |
| `values` | Required. Map from point id (the customization point id grammar: `std.<name>` or `[a-z][a-z0-9-]*`) to a **literal**: a finite number, a boolean, a string of at most 256 characters, or a color object `{ colorSpace, components, alpha? }` as the token schema defines it. Nothing else |
| `$extensions` | Optional. Reverse-domain keys to any JSON. Preserved, never interpreted |

Any other member is `OT-PREF-005`. Documents never contain theme data, policy, or host data.

## Limits (fixed; not host-configurable)

| Limit | Value | Code |
|---|---:|---|
| Document bytes (checked before parsing) | 65,536 | `OT-PREF-002` |
| Nesting depth | 8 | `OT-PREF-002` |
| Entries in `values` | 512 | `OT-PREF-007` |
| String value length | 256 characters | `OT-PREF-008` |

## Two validation levels

1. **Document level (error)**: the document is unusable, the scope behaves as if nothing were
   stored, and the stored bytes are not overwritten (FB-C003).
2. **Value level (warning, `OT-PREF-008`)**: a `values` entry that is not a permitted literal
   (for example an object other than a color, an array, a reference such as `{ "$ref": … }`, an
   expression, or an over-long string). That entry is left out when compiling to the resolution
   input, kept in storage unchanged, and every other entry applies.

Type and constraint checks against a specific theme's point remain resolution-time findings
(`OT-CUS-101`–`104`, FR-044). The document never learns about themes.

## Diagnostics (new registry area `PREF`)

| Code | Severity | Meaning |
|---|---|---|
| `OT-PREF-001` | error | Not well-formed I-JSON (syntax, duplicate members, invalid strings) |
| `OT-PREF-002` | error | Size or nesting limit exceeded |
| `OT-PREF-003` | error | `openthemePreferences` missing or not `MAJOR.MINOR` |
| `OT-PREF-004` | error | Unsupported format version (newer minor or other major); params state the supported range |
| `OT-PREF-005` | error | Unknown member outside `$extensions` |
| `OT-PREF-006` | error | Invalid `selection` or `previous` shape, identifier, or version |
| `OT-PREF-007` | error | Invalid point id in `values`, or more than 512 entries |
| `OT-PREF-008` | warning | A value is not a permitted literal; the entry is ignored and kept |
| `OT-PREF-009` | warning | A migration from a previous major lost information |

Locations use `document: "preferences"` plus a JSON Pointer. Ordering and the 200 cap follow
chapter 13. Parameters never echo stored free text (FR-071).

## Canonical form and writing

Core writes documents as JCS canonical bytes (research R3). Writing happens only on explicit user
intent (FR-C063). A read-validate-write round trip of a valid document is byte-identical.

## Conformance

A new runner kind is added to NDJSON protocol 1 (additive):

| Kind | Input | `expect` members | Comparison |
|---|---|---|---|
| `validate-preferences` | `{ "document": <bytes or JSON> }` | `usable` (boolean), `values` (the compiled map), `diagnostics` | Exact `(code, location)` list; JCS equality for `values` |

Fixtures cover every code, including malicious cases (oversized, deep nesting, duplicate keys,
prototype-named members, bidirectional control characters in string values, and references or
expressions as values).
