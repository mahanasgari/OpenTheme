# Security Review: Core admission, registry, preferences, and controller

**Scope**: `packages/core/src/{parse,admission,registry,canonical,preferences,controller}/**`,
`packages/core/src/settings.ts`, `packages/core/src/core.ts`, and
`packages/core/src/resolve/{compile,presets,context-input,cache}.ts` (AGENTS.md invariant 7;
task T082). **Reviewed**: 2026-09-25, against FR-C010 to FR-C034, FR-C083, FR-C086, and
research CR13.

## Trust boundary

- [x] Trust comes only from `AdmissionRequest.trust`. `checkTrustAndSource` reads no document
  byte, and nothing in the registry derives trust from `id`, `provenance`, `$extensions`, or
  integrity (FR-C020, FR-C021).
- [x] A missing or unknown trust value refuses with `trust-missing`, before the bytes' type is
  even checked. There is no default to trusted.
- [x] Untrusted admissions check the source category (missing, unknown, not allowed) before any
  size check or parsing. `admitFrom` checks it before calling `ThemeSource.load()`, so a
  disallowed source never causes host I/O (tested).
- [x] A trusted admission that carries a source is refused (`invalid-argument`), so a caller
  cannot mix the two models.
- [x] The chain's lowest trust gates a trusted child of an untrusted base (FR-C023): the child is
  gated as untrusted (accessibility), without a source check, because its own admission had none.
- [x] An untrusted entry never shadows a trusted one: compilation lists trusted entries first
  (F1), `listSelectable` drops untrusted entries whose id a trusted entry holds, and resolution
  reports `OT-SEC-001` (tested in both admission orders).

## Untrusted input handling

- [x] Theme and host bytes: the size is checked before UTF-8 decoding (`parseIJson`), then strict
  I-JSON parsing with the depth limit applied during tokenization. Parsed objects have a `null`
  prototype.
- [x] Stored documents are deep copies (JSON round trip of parsed JSON) and deeply frozen. Snapshot
  entries and every returned result are frozen; later admissions cannot change a snapshot
  (FR-C032, tested).
- [x] User Preferences bytes: 65,536-byte limit before parsing, depth 8, 512 values, and
  permitted literals only. `setValue` and `preview` accept only permitted literals and valid point
  ids, so the controller can never persist a value that `parse` would reject.
- [x] A preferences document of a newer or unsupported format is unavailable and is never
  overwritten, whether it arrives from the store or through `importDocument` (tested).

## Operational errors and diagnostics

- [x] Operational error messages are fixed strings. The only interpolated values are a validated
  source category and pointers into the caller's own arguments. No document text is reproduced
  (FR-C086).
- [x] Diagnostics come from the validators unchanged; the admission gate returns the
  `OT-A11Y-003` diagnostics as produced (FR-C028).
- [x] Store failures are recorded in `errors` and never change the applied result. A stored
  document that arrives after a newer user change is discarded with `superseded` (FB-C004).

## Resource bounds

- [x] `registryCapacity` refuses further admissions and never evicts (FR-C074, tested). Identical
  re-admissions return `already-registered` without growing the registry.
- [x] The result cache is bounded by `cache.results` (0 disables it). Its key covers the trust and
  integrity of every reachable theme, the host integrity, the specification version, and the JCS
  of the request and the compiled policy (FR-C071). Hits return the same frozen object a miss
  would compute (tested byte for byte with the cache on and off).

## Findings

1. **Gated entries reachable as bases** (low; fixed during review). A theme whose gate refuses
   it (for example, its source was turned off) is still passed to resolution when an admitted
   theme extends it, because bases are resolved from the same theme set (chapter 10). Compilation
   now removes identifiers held only by such entries from `availableThemes`, so they are never
   selected directly (tested).
2. **Unparsable documents are not registered** (informational). Bytes that are not a JSON object
   return `status: "invalid"` with `entry: null`: there is no identity to register. Their
   diagnostics are still returned (FR-C033 reporting).

## Addendum (2026-09-26): previous-major admission (T123, FR-C101)

- [x] A migration manifest comes only from the host (`AdmissionRequest.migration`), never from the
  document, and is shape-checked (`invalid-argument` otherwise).
- [x] It applies only to a document exactly one major below the supported one with a manifest
  targeting the supported major; anything else is admitted unchanged and fails as unsupported.
- [x] Trust and source checks run before parsing, as for every admission; the migrated document
  keeps the admission's trust and passes the same validation and gates as any other document.
- [x] Migration works on a copy of the frozen parsed document; the result is frozen before
  validation. `OT-VER-003` and lossy `OT-VER-004` are reported with the admission diagnostics.
