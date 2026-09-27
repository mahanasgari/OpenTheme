# Changelog

## Unreleased (errata to 1.0.0-draft.1)

### Specification errata

- `resolution-input.schema.json` now matches the resolution contract, data model §14, chapter
  12, chapter 15, and the fixtures on per-document trust. It adds
  `themes: [{ trust, document }]` with `trust` required, and removes the unused
  identifier-keyed `trustedIds` and the trust-less `bases` (bases are resolved from `themes`).
  `theme` is documented as shorthand for one trusted entry. No expected result changes.
- Chapter 10 adds `R-RES-005`: when a selection, `previous`, or `defaultTheme` names no
  version, the candidate with the highest SemVer 2.0.0 precedence is chosen regardless of input
  order. An invalid highest version falls back as a whole and is never replaced by an older
  version. No existing expected result changes.
- New chapter 18 and schema `schemas/user-preferences/1.0/user-preferences.schema.json`: the
  User Preferences document, format `1.0`, versioned independently of the Theme Specification.
  New diagnostics `OT-PREF-001` to `OT-PREF-009`, rules `R-PREF-001` to `R-PREF-009` (009 is
  reserved until a previous preferences major exists), and `preferences` as a diagnostic
  location document, ordered after `input` (chapter 13).
- Chapter 13 defines pointer canonical order: UTF-16 code-unit order of the pointer strings (and
  then of the codes), as JCS orders member names. It never depends on a locale.
- Chapter 05 now states the gamut-mapping algorithm as normative pseudocode. The previous text
  pointed to the CSS Color 4 pseudocode, which the published results never followed: lightness is
  clamped, the gamut test and clip run in linear sRGB, and the 24 bisection steps scale chroma
  with no early exit. No expected result changes.
- Chapter 04 now states every color transformation and algorithms A1 and A2 as normative
  pseudocode: the `color.mix` weights, immediate gamut mapping in `lightness`, `chroma`, and `hue`,
  clamped `alpha`, `composite` on quantized inputs without re-quantizing, and A1's bisection
  toward the gamut-mapped endpoint's lightness. No expected result changes.
- Resolved output (chapter 10, "Resolved values"): encodings by type are normative, composite
  members are fully resolved (no aliases remain, FR-057), and nested colors are quantized. The
  resolved `context` members, including `seedScheme` and `locale`, are listed.
- New baseline token `border.default` (type `border`), and every standard contract's
  `container.border` defaults to it, so every standard contract property has a default (FR-057).
- Chapter 08 specifies resolved `components` (per-state values, theme styling and overlays,
  locks, `$variants`, forced colors), layout fallback across size classes, and `OT-LAY-001` for
  regions or variants a supplied host does not declare.
- Chapter 09 specifies resolution-time preference statuses and color-preference clamping.
- Chapter 11: the effective text scale is rounded to 12 decimal places; literal ranges are type
  bounds only (registry role ranges bound derivation outputs).
- Chapter 13 specifies the validation procedure, the schema-failure mapping, and whole-document
  locations; chapter 17 specifies how host schema failures and host rules combine.
  Validation step 12 (accessibility) evaluates the high-contrast mode of each supported color
  scheme and runs only when no earlier step reported an error.
- Chapter 11 specifies the accessibility conformance report (FR-064): its modes, pairs,
  thresholds, and `OT-A11Y-003` location and parameters. It had been required but not defined.
  Validity and every expected result are unchanged.
- `defs/tokens.schema.json` (finding F33): `fontFamilyList` items are `anyOf` a family name or a
  generic family. With `oneOf`, every generic family (which also matches the family-name pattern)
  was rejected, so no font-family list could be valid in an overlay or a preset value.
- Chapter 12 states that trust is per document entry and that entry order never lets an
  untrusted document replace, shadow, or deny a trusted one.

### Conformance errata

- New negative fixtures in `resolution/us2/`: `identity-collision-untrusted-first`,
  `identity-claim-no-trust`, `base-shadow-untrusted-first`, and `baseline-impostor`.
- New fixtures `resolution/selection/unversioned-highest`, `unversioned-order-independent`,
  and `unversioned-highest-invalid`.
- The runner's sweeps, host coverage, and SC-011 round-trip check can run against any
  implementation: `--sweeps --impl <command>` sends every request over protocol 1. Without
  `--impl`, sweeps still run the reference checker in-process, with the same results.
- New runner kind `validate-preferences` and 24 fixtures under `preferences/` (valid, invalid,
  malicious, and limit boundaries).
- **Bug fix** (kernel golden vectors): 199 vectors in `kernels/cbrt.json` (22),
  `kernels/log2.json` (1), and `kernels/exp2.json` (176) contradicted chapter 05 at extreme
  magnitudes. They were regenerated; every input and every other vector is unchanged. No color or
  resolution result depended on them.
- `kernel` requests now carry their input vectors (never the expected outputs).
- **Bug fix** (finding F32): chapter 05 states that `ldexp` rounds once. Fifteen `exp2` vectors
  with subnormal results were added to `kernels/exp2.json`; every existing vector is unchanged.
  The reference checker and the Python kernel cross-check rounded repeatedly when halving into
  the subnormal range and were one ulp off on rare inputs; both are fixed.
- **Bug fix**: `invalid/cus/too-many-targets` expects `OT-DOC-004` (an unannotated schema
  combinator failure), not `OT-META-001` (the invalid-identifier code).
- **Bug fix**: component-contract pointers are escaped per RFC 6901 (`com.example.notes~1timeline`)
  in six resolution fixtures.
- **Bug fix**: `resolution/us5/unknown-region` expects the undeclared region to be ignored with
  `OT-LAY-001`; the four `complete-graphite-*` fixtures now also expect that informational
  diagnostic for Graphite's `library` region against the notes host.
- New fixture `valid/ref/baseline-alias`: a theme token may alias a baseline token.
- New fixtures pinning the token literal grammar and ranges (finding F26): durations as
  `{ value, unit: "ms" }` and within 1000 ms, density keywords, integer font weights, composite
  member ranges, colors requiring `colorSpace` and `components`, and sRGB components within
  [0, 1]; plus `valid/ctx/overlay-font-family` (F33).
- New runner kind `accessibility-report` (chapter 11, finding F31): input as for `validate`;
  the result is the theme's validity and, for a valid theme, only the conformance report's
  `OT-A11Y-003` findings. Four fixtures under `accessibility/`; `R-A11Y-003` now names them.
- Spec-lint validates every `resolve` fixture input against `resolution-input.schema.json`.

### Tooling errata (non-normative)

- Reference checker: `validate-preferences` support. The type generator and spec-lint now
  cover every schema under `specification/schemas/`, not only `1.0/`.
- Reference checker and Python kernel cross-check, bug fix: `TWO_60` was 2^61, which doubled
  `ldexp` results for every 60-exponent step, and subnormal `frexp` started at -1022. Both are
  fixed, with regression tests at extreme magnitudes.
- Reference checker, bug fix: diagnostics were ordered with `localeCompare`; they now use
  UTF-16 code-unit order (chapter 13).
- Reference checker and Python kernel cross-check, bug fix: `cbrt` computed `(m − 1) × (1/7)`
  with a rounded constant; chapter 05 specifies `(m − 1) / 7`. They differed by one ulp on rare
  inputs (for example `0x3FE18A491DBFAA7E`). No golden vector or expected result changed.
- Reference checker, bug fixes: composite members are resolved in output; aliases to baseline
  tokens are valid reference targets; unannotated combinator failures map to `OT-DOC-004`;
  component pointers are RFC 6901-escaped; undeclared layout regions and variants are ignored
  with `OT-LAY-001`.
- Reference checker, bug fix: unversioned selection used the last matching entry, which
  depended on input order; it now applies `R-RES-005`.
- Reference checker, bug fix: an entry without an explicit `trust: "trusted"` is untrusted. An
  untrusted entry listed before a trusted one with the same identifier no longer denies the
  trusted one (it used to fall back with `OT-SEC-002`). An untrusted document claiming the
  baseline identifier no longer suppresses the built-in specification baseline.
- Reference checker, bug fix: resolved `components` follow chapter 08. The checker used to emit
  contract defaults for the `default` state only. It now applies theme styling and overlays,
  per-state values, locks, `$variants`, and forced colors.
- Reference checker, bug fix: `OT-A11Y-002` checked one hard-coded overlay pair. It now checks
  every registry pair except disabled pairs in the high-contrast mode of each supported color
  scheme (chapter 11), after an error-free validation (chapter 13). No expected result changed.
- Reference checker, bug fix (F26): token literals are checked against the `tokens.schema.json`
  definitions (duration and density were validated as numbers; composite members and sRGB bounds
  were not checked). Core, bug fix: hex-only colors are no longer accepted as token values, and
  literal composite members are bounded like tokens of their type.
- Reference checker, bug fixes (F27): validation evaluates derivations in every mode and
  reports `OT-DRV-004` for an aliased operand whose value is outside the argument's domain;
  `OT-REF-002` is no longer reported for derivation operands that alias non-color tokens.
  Fixtures `valid/drv/alias-operand-in-domain`, `invalid/drv/alias-operand-out-of-domain`, and
  `invalid/drv/overlay-operand-out-of-domain`.
- Conformance runner: `OT_CROSSCHECK_DUMP=<file>` writes the inputs of differing sweep
  resolutions during `--compare-impl` sweeps.

## 1.0.0-draft.1

### Specification

- Normative chapters `00`–`17` covering document format, metadata, tokens, contexts,
  components, customization, layout, inheritance, resolution, accessibility, security,
  diagnostics, versioning, extensions/provenance, design-tokens mapping, and host
  declarations.
- JSON Schemas under `specification/schemas/1.0/` for themes, hosts, fixtures,
  resolution input/output, and shared defs.
- Registries: rules, diagnostics, transformations, limits, forced-colors,
  semantic-baseline.
- Reference themes: baseline, Aurora, Graphite.
- Example hosts: `com.example.notes`, `com.example.media`.
- Annotated examples `01`–`08` plus invalid samples and the corner-roundness edit guide.
- Machine entry point `specification/llms.txt`.

### Conformance

- Fixture classes: valid, invalid, malicious, resolution (matrix + US1–US8),
  canonical, inheritance, versioning, examples, kernels.
- Runner protocol kinds: validate, validate-host, resolve, canonicalize, flatten,
  export-check, compare-versions, migrate, kernel.
- Sweeps for seeds (SC-015), accents (SC-014), official themes, and host coverage.

### Tooling (non-normative)

- Reference checker CLI `ot-ref`.
- Spec-lint, types generation, bench, kernel cross-check.
- Manual evaluations under `evaluations/` (not CI).
