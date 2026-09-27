# Security review — parse, limits, diagnostic params

**Date**: 2026-09-25  
**Scope**: `tools/reference-checker/src/parse/`, limit enforcement in `validate/`, diagnostic
params vs research R14/R15 and FR-071 (Principle VI).

## Findings

| ID | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| S1 | Document size must fail before parse at 1 MiB | Medium | `validate/document.ts` `MAX_BYTES` aligned to 1 048 576; parse retains the same guard |
| S2 | Ajv `additionalProperties` / `required` codes collapsed to theme-level `OT-DOC-003` | Medium | `schema/validate.ts` uses `verbose` parentSchema codes; `required` always `OT-DOC-005` |
| S3 | Combinator `anyOf`/`oneOf` branch noise obscured real codes | Medium | Branch errors filtered; token-tree schema noise suppressed in favor of semantic TOK/REF/DRV |
| S4 | Display text lacked pattern enforcement for bidi/C0 | High | `display-text.schema.json` pattern → `OT-META-004`; length → `OT-META-005` |
| S5 | Font family seeds accepted URLs | High | Seeds `fontFamily` items `$ref` family-name grammar → `OT-TOK-004` |
| S6 | Diagnostic param kinds | Low | Collector still rejects non-grammar params (`ParamError`); fixtures use `detail` strings/numbers only |
| S7 | Effort / nesting pathological inputs | Medium | Property test `bounded-effort.test.ts`; generators for pad/nest/token/overlay/path |

## Residual risk

- Capability scan (`capability-scan.ts`) is advisory until wired into every `spec:check` gate with
  a curated allowlist for intentional open `$extensions` maps.
- Inheritance trust depends on callers supplying accurate `trust` on base entries.

## Sign-off

US2 security-focused review complete for the parse and limit path; open items tracked above.

## Addendum — per-document trust (F1), 2026-09-25

**Scope**: `specification/schemas/1.0/resolution-input.schema.json`,
`tools/reference-checker/src/resolve/select.ts` (theme set construction and trust).

| ID | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| S8 | The schema had no `themes` member and had an identifier-keyed `trustedIds`. Keying trust by id would let any document that claims a trusted id become trusted (FR-010, FR-068) | High | `themes[]` with required per-entry `trust`; `trustedIds` and trust-less `bases` removed; spec-lint validates every resolve fixture input against the schema |
| S9 | A missing or unrecognized `trust` value defaulted to `trusted` (fail open) | High | Only the exact value `trusted` grants trust; anything else is untrusted (unit tests) |
| S10 | Order dependence: an untrusted entry listed before a trusted entry with the same id@version caused `OT-SEC-002` and fell back, which denied the trusted theme; it could also be picked as an inheritance base | High | Trusted entries (including the `theme` shorthand and the built-in baseline) are registered before untrusted ones; fixtures `identity-collision-untrusted-first`, `base-shadow-untrusted-first` |
| S11 | An untrusted document with the baseline id suppressed the built-in specification baseline | Medium | The baseline is suppressed only by a trusted entry; fixture `baseline-impostor` |

Residual: `findPreviousTheme` in `resolve/index.ts` matches `previous` against all entries
regardless of trust. It only drives the informational `OT-CUS-104` skip and cannot change applied
values, so it is left as is and noted for the production core.

## Addendum — User Preferences document (Core prerequisite P3), 2026-09-25

**Scope**: `specification/schemas/user-preferences/1.0/`, chapter 18,
`tools/reference-checker/src/preferences/validate.ts`, the `limits` option added to
`tools/reference-checker/src/parse/ijson.ts`, and the `validate-preferences` protocol kind.

| ID | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| S12 | Stored preferences are untrusted input that reaches resolution | High | Size limit 65536 bytes checked before tokenizing, depth 8 during tokenizing, I-JSON with duplicate rejection, null-prototype objects; fixtures `preferences/malicious/*` and boundary fixtures at the limits |
| S13 | One malformed value could discard all personalization, or a non-literal value (reference, derivation) could reach resolution | Medium | Two validation levels: non-literal values are dropped from the compiled map with `OT-PREF-008` and kept in storage; only permitted literals compile |
| S14 | Diagnostics could echo stored strings (FR-071) | Medium | Parameters carry only the supported-version range and member names from the fixed vocabulary; never stored values |
| S15 | Bidirectional or control characters in string values | Low | Such strings are not permitted literals (`OT-PREF-008`), fixture `preferences/malicious/bidi-in-value` |

Residual: the parser's `maxBytes`/`maxDepth` options default to the theme limits, so existing
theme parsing is unchanged. Core implements its own parser (research CR3) and is reviewed
separately.
