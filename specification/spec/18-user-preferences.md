# 18. User Preferences Document

**Status**: Normative. User Preferences format `1.0`. Schema:
`specification/schemas/user-preferences/1.0/user-preferences.schema.json`. Diagnostics: the `PREF`
area of `diagnostics.json`.

## Purpose

A User Preferences document stores one scope's personalization separately from every theme
(constitution II): the user's selected theme, the last theme applied without fallback, and the
values the user chose for customization points. It never contains theme data, developer policy,
or host application data. It is versioned independently of the Theme Specification.

A document compiles into the `selection`, `previous`, and `preferences` members of the resolution
input (chapter 10) and has no other meaning. Whether a value takes effect is decided only at
resolution, by the customization rules of chapter 9 and the precedence of chapter 10.

## Members (R-PREF-003 to R-PREF-007)

| Member | Rule |
|---|---|
| `openthemePreferences` | Required. The format version as `MAJOR.MINOR`, for example `"1.0"` |
| `selection` | Required. `null`, or `{ id, version? }` with a theme identifier (chapter 02) and an optional SemVer version |
| `previous` | Required. `null`, or `{ id, version }`: the last theme applied with `fallback: "none"` |
| `values` | Required. An object mapping customization point ids (`std.<name>` or `[a-z][a-z0-9-]*`, chapter 09) to literal values. It may be empty |
| `$extensions` | Optional. Reverse-domain keys to any JSON value. Preserved and never interpreted (chapter 15) |

Any other member is an error (`OT-PREF-005`).

A **permitted literal** is a finite number, a boolean, a string of at most 256 characters without
C0 controls or bidirectional override and embedding controls, or a color value as defined by
`#/$defs/color` in `specification/schemas/1.0/defs/tokens.schema.json`. Nothing else is a
permitted literal: no arrays, no other objects, no references, and no derivations.

## Limits (R-PREF-002)

Limits are fixed by this chapter and are not configurable.

| Limit | Value | Code |
|---|---:|---|
| Document bytes, checked before parsing | 65 536 | `OT-PREF-002` |
| Structural nesting depth (the top-level object is depth 0; no value deeper than 8) | 8 | `OT-PREF-002` |
| Entries in `values` | 512 | `OT-PREF-007` |
| String value length | 256 characters | `OT-PREF-008` |

## Validation levels

Parsing follows the untrusted-input rules of chapter 12: size before parsing, I-JSON, duplicate
members rejected, and nesting checked during tokenization. A User Preferences document is always
untrusted input.

1. **Document level** (`R-PREF-001` to `R-PREF-007`). Errors make the document **unusable** as a
   whole: it compiles to nothing, and the scope behaves as if no document were stored.
   Implementations MUST NOT overwrite a stored unusable document except on an explicit user
   action.
2. **Value level** (`R-PREF-008`). A `values` entry whose value is not a permitted literal
   produces the warning `OT-PREF-008`. That entry is left out of the compiled `preferences`, it
   stays in the stored document unchanged, and every other entry still applies.

Checks of a value against a particular theme's customization point (type, range, enumeration)
are not part of document validation. They happen at resolution under chapter 09 (`OT-CUS-101` to
`OT-CUS-104`), so the document never depends on which theme is selected.

## Versions (R-PREF-004, R-PREF-009)

A reader that supports format `M.N` accepts `M.0` through `M.N`. A newer minor or another major
is unsupported (`OT-PREF-004`) and the document is unusable. When a later major version exists,
readers MUST accept documents of the previous major through a deterministic migration during its
published deprecation window, and report any lost information with `OT-PREF-009`.

## Diagnostics

| Code | Severity | Condition |
|---|---|---|
| `OT-PREF-001` | error | Not well-formed I-JSON, a duplicate member, or a top-level value that is not an object |
| `OT-PREF-002` | error | Size or nesting limit exceeded |
| `OT-PREF-003` | error | `openthemePreferences` missing or not `MAJOR.MINOR` |
| `OT-PREF-004` | error | Unsupported format version |
| `OT-PREF-005` | error | Unknown member outside `$extensions`, or a required member missing |
| `OT-PREF-006` | error | Invalid `selection` or `previous` |
| `OT-PREF-007` | error | `values` is not an object, a key is not a point id, or there are more than 512 entries |
| `OT-PREF-008` | warning | A value is not a permitted literal; the entry is ignored and kept |
| `OT-PREF-009` | warning | Migration from a previous major lost information |

Locations use `document: "preferences"` and a JSON Pointer. Ordering and the 200-entry cap follow
chapter 13. Parameters never reproduce stored strings (FR-071).

## Canonical form

Implementations write documents in the canonical form of chapter 01 (JCS). Reading and writing a
usable document without changes produces identical bytes.

## Conformance

The runner kind `validate-preferences` takes `{ "document": … }`, where the document is a string
of bytes or a JSON value. It expects `usable` (boolean), `values` (the compiled preferences map),
and the exact list of diagnostics.
