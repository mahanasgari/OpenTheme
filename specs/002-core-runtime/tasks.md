---

description: "Task list for OpenTheme Core Runtime"
---

# Tasks: OpenTheme Core Runtime

**Input**: Design documents from `specs/002-core-runtime/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. Constitution Principle X makes tests mandatory for core, the untrusted-input
pipeline, policy enforcement, and migrations. The Quality Gates require test tasks for those
scopes whatever the template default. Write each story's tests first and confirm they fail.

**Organization**: Grouped by user story (spec.md). Phase 1 holds the additive Foundation
prerequisites P1–P4 (research.md) and the package scaffold. Phase 2 holds the parsing,
validation, and registry machinery that every story needs.

**Normative rule for every task**: the Foundation (`specification/**`, `conformance/**`) is the
source of truth. Never import or copy `tools/reference-checker` into `packages/core` (FR-C005,
research CR2). Diagnostic codes come only from `specification/registry/1.0/diagnostics.json`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US7 from spec.md

---

## Phase 1: Setup (Foundation prerequisites P1–P4 and scaffold)

**Purpose**: Additive Foundation changes that Core depends on, then the workspace skeleton.
Each P-group ends with `pnpm verify` green.

### P1: Unversioned selection errata (clarification 4, FR-C034, finding F5)

- [X] T001 Add the rule "when a selection names no version, the selectable version with the highest SemVer precedence is chosen regardless of input order; if it is invalid or unsupported, FB-001 applies and older versions are not searched" to the "Selection, trust, and fallback" section of `specification/spec/10-inheritance-and-resolution.md`, and register it as `R-RES-005` in `specification/registry/1.0/rules.json`
- [X] T002 [P] Add fixtures `conformance/fixtures/resolution/selection/unversioned-highest.json` (1.0.0 and 1.2.0 registered, 1.2.0 listed first → 1.2.0 applied), `unversioned-order-independent.json` (same themes, reversed order, identical expected result), and `unversioned-highest-invalid.json` (highest version invalid → `applied.fallback` per FB-001 and never the older version), each with `"rules": ["R-RES-005"]`
- [X] T003 Change `pickEntry` in `tools/reference-checker/src/resolve/select.ts` to choose the highest SemVer precedence among non-conflicted entries (reuse the version comparison in `tools/reference-checker/src/versioning/`), and add `tools/reference-checker/test/unit/resolve/select-version.test.ts` covering order independence and pre-release precedence
- [X] T004 [P] Record P1 under "Unreleased (errata to 1.0.0-draft.1)" in `specification/CHANGELOG.md` and add one sentence on the rule to `specs/001-theme-specification-foundation/contracts/resolution.md` stage 1 **Select**

### P2: Sweeps over the runner protocol (finding F11)

- [X] T005 Refactor `conformance/runner/src/sweeps/seeds.ts`, `conformance/runner/src/sweeps/accents.ts`, the official-theme sweep, and `conformance/runner/src/checks/host-coverage.ts` so they build `resolve` requests and send them through the protocol client in `conformance/runner/src/protocol.ts` to the configured `--impl`, asserting exactly the same properties as today; the default `--impl` stays the reference checker
- [X] T006 Allow `--sweeps` together with `--impl <command>` in `conformance/runner/src/main.ts` and update the usage text
- [X] T007 [P] Add `conformance/runner/test/sweeps-protocol.test.ts` proving a sweep run through the protocol reports the same counts and failures as before on the reference checker

### P3: User Preferences contract (clarifications 1 and 3, FR-C067–FR-C069)

- [X] T008 Write `specification/spec/18-user-preferences.md` (normative, ≤ 100-character prose lines) from `specs/002-core-runtime/contracts/user-preferences-document.md`: members, the two validation levels, compile semantics, limits, codes, canonical writing, and versioning
- [X] T009 [P] Write `specification/schemas/user-preferences/1.0/user-preferences.schema.json` (draft 2020-12, `x-opentheme-code` / `x-opentheme-rule` annotations, a description and examples on every property). Quote the limits exactly: "Document bytes (checked before parsing) 65,536", "Nesting depth 8", "Entries in `values` 512", "String value length 256 characters". Point id pattern `^std\.[a-z][a-z0-9-]*$` or `^[a-z][a-z0-9-]*$`; value = finite number | boolean | string ≤ 256 | color object per `tokens.schema.json`
- [X] T010 [P] Add `OT-PREF-001` … `OT-PREF-009` with the severities in the contract table (001–007 error, 008–009 warning) to `specification/registry/1.0/diagnostics.json`, and `R-PREF-001` … `R-PREF-009` to `specification/registry/1.0/rules.json`
- [X] T011 Add `validate-preferences` to the `kind` enum in `specification/schemas/1.0/fixture.schema.json`, and implement its expectation comparison (`usable`, JCS-equal `values`, exact `(code, location)` diagnostics) in `conformance/runner/src/compare.ts` and `conformance/runner/src/fixtures.ts`
- [X] T012 [P] Add fixtures under `conformance/fixtures/preferences/valid/`, `conformance/fixtures/preferences/invalid/`, and `conformance/fixtures/preferences/malicious/`: at least one per `OT-PREF-*` code, plus oversized (65,537 bytes), depth 9, duplicate keys, `__proto__` member, bidirectional controls in a string value, `{ "$ref": … }` value, 513 entries, `openthemePreferences: "1.9"`, `"2.0"`
- [X] T013 Implement `validate-preferences` in the non-normative reference checker at `tools/reference-checker/src/preferences/validate.ts`, wired into `tools/reference-checker/src/conformance/serve.ts` handshake and dispatch, with tests in `tools/reference-checker/test/unit/preferences/validate.test.ts`
- [X] T014 [P] Extend `tools/spec-lint/src/schemas.ts`, `tools/spec-lint/src/machine-readability.ts`, and `tools/types/scripts/generate.ts` to include `specification/schemas/user-preferences/**`, and add `PREF` to the rule areas checked by `tools/spec-lint/src/traceability.ts`
- [X] T015 [P] Append a P3 security-review addendum (parser limits, value-level isolation, no echo of stored text) to `specs/001-theme-specification-foundation/checklists/security-review.md`, and add a CHANGELOG entry to `specification/CHANGELOG.md`

### P4: Agent documentation

- [X] T016 [P] Update `AGENTS.md` (the repository now ships `packages/core`; `PREF` rule area; Core commands; the invariant that Core never imports the reference checker) and `specification/llms.txt` (user preferences chapter and schema)

### Scaffold

- [X] T017 Add `packages/*` to `pnpm-workspace.yaml`, and add root scripts `conformance:core`, `sweeps:core`, `crosscheck:core`, `bench:core`, and `size:core` to `package.json`, with `verify` = `spec:check && test && conformance && conformance:core && sweeps && sweeps:core && crosscheck:core && kernels:crosscheck && bench && bench:core && size:core`
  - Note: Core gates join `verify` only once they pass, so `verify` stays green meanwhile (conformance:core is currently excluded: see finding F16). T120 adds the full set.
- [X] T018 Create `packages/core/package.json` (`@opentheme/core`, version `0.1.0-draft.0`, `type: module`, `sideEffects: false`, `exports` of `./dist/index.js` only, no runtime `dependencies`), `packages/core/tsconfig.json` (target and lib ES2022 with **no** `DOM` lib, `types: []`, strict), and `packages/core/src/index.ts`
- [X] T019 [P] Create `packages/core-conformance/package.json` (private) and `packages/core-conformance/src/main.ts` implementing the NDJSON handshake of `specs/002-core-runtime/contracts/conformance-harness.md`, replying `unsupported` for every kind until implemented
- [X] T020 [P] Add `packages/core` and `packages/core-conformance` to the Vitest projects in `vitest.config.ts`
- [X] T021 Write `packages/core/scripts/generate-artifacts.ts`: emit frozen modules into `packages/core/src/generated/` for the registry fields Core needs (research CR6), the specification baseline theme, and Ajv 8 **standalone** validators for `theme.schema.json`, `host-declaration.schema.json`, and `user-preferences.schema.json` (Ajv as a devDependency only; no `new Function` in the output)
- [X] T022 [P] Add a second output of `tools/types/scripts/generate.ts` to `packages/core/src/generated/types/`
- [X] T023 [P] Add `tools/spec-lint/src/core-freshness.ts` (regenerate in memory and fail if `packages/core/src/generated/**` differs) and wire it into `tools/spec-lint/src/main.ts`
- [X] T024 [P] Add `tools/spec-lint/src/core-boundaries.ts`: fail if `packages/core/src/**` imports `@opentheme/reference-checker`, `tools/reference-checker`, or `node:*`, or uses `fetch`, `XMLHttpRequest`, `WebSocket`, `Date`, `performance`, `Math.random`, `crypto`, `localStorage`, `sessionStorage`, `indexedDB`, `document`, `window`, `eval`, or `new Function`; and apply the no-platform-math rule (AGENTS.md invariant 2) to `packages/core/src/{kernels,color,transforms}/**`
- [X] T025 [P] Add `packages/core/scripts/size.ts`: bundle `packages/core/dist/index.js` minified (esbuild as a devDependency, justified here) and fail if gzip size > 100 KB (research CR16), excluding the optional English-templates module

**Checkpoint**: P1–P4 merged, `pnpm verify` green, and the harness handshake passes with everything `unsupported`.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Admission of **trusted** documents end to end: parse, validate, canonicalize, and
register. Every story needs it.

- [X] T026 Implement operational errors in `packages/core/src/errors/operational.ts`: the closed kind list and the `{ kind, operation, pointer?, message, hint, docs }` shape exactly as in `specs/002-core-runtime/contracts/operational-errors.md`, plus `OpenThemeCoreError` for thrown programming errors
- [X] T027 [P] Implement `packages/core/src/diagnostics/collector.ts`: registry codes only, severity and rule from the generated registry, chapter 13 ordering (document: theme, bases nearest to farthest, host, input, preferences; then pointer canonical order; then code), a cap of 200 followed by `OT-LIM-099` with the omitted count, and parameters restricted to grammar-constrained values (FR-071)
- [X] T028 [P] Implement the bounded I-JSON tokenizer in `packages/core/src/parse/ijson.ts` (research CR3): byte-length check before decoding with a caller-supplied limit (theme 1,048,576; preferences 65,536), nesting depth enforced during tokenization, duplicate-member detection, null-prototype result objects, and I-JSON number and string rules, mapped to `OT-DOC-*`/`OT-LIM-*` codes per chapters 01 and 12
- [X] T029 [P] Implement the chapter 05 binary64 kernels in `packages/core/src/kernels/` with no platform math
- [X] T030 [P] Implement `packages/core/src/color/` (OKLab/OKLCH conversion, CSS Color 4 gamut mapping, compositing, WCAG 2.2 contrast, sRGB 8-bit quantization) from research R6 and R8 using only `packages/core/src/kernels/`
- [X] T031 [P] Implement `packages/core/src/canonical/jcs.ts`, `packages/core/src/canonical/sha256.ts` (pure, synchronous), and `packages/core/src/canonical/integrity.ts` per research R3
- [X] T032 Implement the closed transformation set in `packages/core/src/transforms/` from `specification/registry/1.0/transformations.json` and chapter 04 (typed operands, domains, totality)
- [X] T033 Implement schema-failure mapping in `packages/core/src/validate/schema.ts` using the precompiled validators and `x-opentheme-code` / `x-opentheme-rule` annotations (required → `OT-DOC-005`, unknown member → `OT-DOC-003`, combinator branch noise suppressed)
- [X] T034 [P] Implement token graph, references, and cycle detection (depth 16 → `OT-REF-004`) in `packages/core/src/validate/tokens.ts`
- [X] T035 [P] Implement derivation validation (composition depth 8 → `OT-DRV-005`; effort 200,000 units per mode → `OT-DRV-007`) in `packages/core/src/validate/derivations.ts`
- [X] T036 [P] Implement overlays and contexts (≤ 64 overlays, the five dimensions, `OT-CTX-001`…`004`) in `packages/core/src/validate/contexts.ts`
- [X] T037 [P] Implement component, layout, and host-qualified checks in `packages/core/src/validate/components.ts` and `packages/core/src/validate/layout.ts`
- [X] T038 [P] Implement customization-point consistency (`OT-CUS-001`…`006`, text-size min ≥ 1) in `packages/core/src/validate/customization.ts`
- [X] T039 [P] Implement metadata and display-text rules (`OT-META-*`) in `packages/core/src/validate/metadata.ts`
- [X] T040 [P] Implement inheritance (`extends` lookup in the supplied set, caret ranges, depth 4, cycles, `OT-INH-001`…`005`, base-first merge, chain-minimum trust) in `packages/core/src/validate/inheritance.ts`
- [X] T041 [P] Implement the per-mode accessibility report (every declared pair in every supported color scheme × contrast mode; `OT-A11Y-*`) in `packages/core/src/validate/accessibility.ts` (implemented as `conformanceReport`, specified by chapter 11 "Accessibility conformance report", finding F31)
- [X] T042 [P] Implement host-declaration validation (chapter 17, `OT-HOST-*`) in `packages/core/src/validate/host.ts`
- [X] T043 Implement `validateThemeBytes(bytes, { bases, host })` orchestration in `packages/core/src/validate/index.ts`: size, parse, schema, and semantic checks in one pass, and validity = no error diagnostics
- [X] T044 Implement the registry in `packages/core/src/registry/registry.ts` and `packages/core/src/registry/snapshot.ts`: entry identity `(kind, trust, id, version, integrity)`, idempotent `already-registered`, the chapter 12 identity rules with trusted entries ordered before untrusted, immutable snapshots with a monotonic `sequence`, canonical entry order, and the built-in trusted baseline
- [X] T045 Implement trusted admission in `packages/core/src/admission/admit.ts` returning `AdmissionResult` (`registered` | `already-registered` | `invalid` | `refused`), with missing `trust` → `trust-missing` before any parsing (FR-C020, FB-C001) (admission lives in `packages/core/src/registry/registry.ts`; trust and source checks in `admission/sources.ts`)
- [X] T046 Implement harness kinds `validate`, `validate-host`, `canonicalize`, `export-check`, and `kernel` in `packages/core-conformance/src/kinds/`, using only public exports plus the internal kernel entry
- [X] T047 [P] Add parser tests `packages/core/test/unit/parse/ijson.test.ts` and `packages/core/test/property/ijson.property.test.ts` (fast-check: bounded effort, no prototype pollution, duplicate detection)
- [X] T048 [P] Add SHA-256 standard-vector and canonical-fixture tests in `packages/core/test/unit/canonical/integrity.test.ts`
- [X] T049 Run `pnpm conformance:core -- --filter 'valid/*' 'invalid/*' 'malicious/*' 'canonical/*' 'kernels/*' 'examples/*'` via `package.json` and fix Core until those kinds pass

**Checkpoint**: validation-class conformance passes through Core.

---

## Phase 3: User Story 1 - Host developer ships prebuilt themes through Core (P1) 🎯 MVP

**Goal**: Register bundled themes, apply a preset, and get a complete Resolved Theme identical
to the Foundation.

**Independent Test**: quickstart scenario 1 plus every `resolve` fixture through
`conformance:core` and zero differences in `crosscheck:core`.

### Tests for User Story 1

- [X] T050 [P] [US1] Write `packages/core/test/quickstart/quickstart.test.ts` implementing quickstart.md scenario 1 verbatim, including JCS byte equality with the conformance-expected output (`packages/core/test/quickstart/quickstart.test.ts`; byte equality with the reference is covered by `crosscheck:core`)
- [X] T051 [P] [US1] Write `packages/core/test/unit/resolve/presets.test.ts`: the `closed` preset = "`availableThemes` = trusted registered themes; `permittedPoints` = none; `allowedColorSchemes` = light and dark; `accessibilityFloor: "wcag22-aa"`", and `common-personalization` = the same plus the seven standard points with registry constraints
- [X] T052 [P] [US1] Write `packages/core/test/unit/resolve/sync-first-paint.test.ts` asserting that `resolve` returns synchronously and that no promise, timer, or I/O is created (US1 scenario 5)

### Implementation for User Story 1

- [X] T053 [US1] Implement Resolution Request → Foundation resolution input compilation in `packages/core/src/resolve/compile.ts` (the snapshot's selectable entries plus reachable bases as `themes: [{ trust, document }]`, trusted first; host; request members unchanged)
- [X] T054 [P] [US1] Implement policy presets in `packages/core/src/resolve/presets.ts` as frozen data compiling to the abstract policy (research CR14), with `unknown-preset` thrown for other names
- [X] T055 [US1] Implement prepared themes in `packages/core/src/resolve/prepare.ts`: flattened chain, parsed derivations, dependency graph, and topological order per overlay set with canonical-path tie-break, keyed by `(integrity, trust)` of every chain member plus host integrity (`packages/core/src/resolve/prepare.ts`: per-Core, bounded by `cache.preparedThemes`)
- [X] T056 [US1] Implement stage 1 selection in `packages/core/src/resolve/select.ts`: availability under policy, chapter 12 identity rules, the R-RES-005 highest-SemVer rule, the fallback chain previous → developer default → baseline with `OT-RES-001`…`004`, and inclusion of the selected theme's validation diagnostics
- [X] T057 [US1] Implement stage 2 context in `packages/core/src/resolve/context.ts` per chapter 6 (color scheme order, contrast and motion honoring platform requests, density from preference or `standard`, size class from environment)
- [X] T058 [US1] Implement FR-044 enforcement (clamp, snap with ties to the lower value, color gamut-map with alpha forced to 1, discrete fallback, `OT-CUS-101`/`102`/`103`/`104`, never mutating inputs) in `packages/core/src/resolve/enforce.ts`
- [X] T059 [US1] Implement stage 3 declaration layers 1–4 (specification and contract defaults, theme chain and overlays, user values with last-declared point winning, locks and protected paths, mistyped lock → `OT-TOK-004` at `input`) in `packages/core/src/resolve/declare.ts`
- [X] T060 [US1] Implement stage 4 evaluation (Kahn's algorithm, canonical-path ties, effort budget, locked values as fixed inputs) in `packages/core/src/resolve/evaluate.ts`
- [X] T061 [US1] Implement stage 5 post-processing (effective text scale = max(platform, clamp(platform × in-app, min, max)); 24 px target floor with `OT-A11Y-006`; forced-color system roles; reduced-motion values; RTL mirroring except physical values) in `packages/core/src/resolve/postprocess.ts`
- [X] T062 [US1] Implement stages 6 and 7 (quantization; accessibility report; `wcag22-aa` rejection with `OT-A11Y-007` and exactly one re-run of stages 3–7) in `packages/core/src/resolve/quantize.ts` and `packages/core/src/resolve/check.ts`
- [X] T063 [US1] Assemble the Resolved Theme (all `resolved-theme.schema.json` members, deep freeze, `outcome` = `selected` | `selected-with-adjustments` | `fallback` per FR-C087) in `packages/core/src/resolve/output.ts`
- [X] T064 [US1] Implement internal LRU memoization in `packages/core/src/resolve/cache.ts` with the FR-C071 key and default capacities "`cache.preparedThemes` 16" and "`cache.results` 32" (0 disables)
- [X] T065 [US1] Implement `createCore`, `resolve`, `listSelectable` (valid, gate passing, not shadowing, in `availableThemes`, localized display text), and `describeCustomization` in `packages/core/src/core.ts`, and export them from `packages/core/src/index.ts`
- [X] T066 [US1] Implement the harness `resolve` kind in `packages/core-conformance/src/kinds/resolve.ts` (fixture `themes[].trust` passed through; `theme` shorthand trusted; untrusted entries admitted with source `imported`; settings allowing every source with `accessibilityGate: "relaxed"`)
- [X] T067 [US1] Implement `packages/core-conformance/src/crosscheck.ts` sending every fixture and sweep request to both implementations and failing on any JCS byte difference (implemented in the runner as `--compare-impl`, `conformance/runner/src/crosscheck.ts` and `sweeps/impl.ts`; `pnpm crosscheck:core` and `crosscheck:core:sweeps` are in `verify`)
- [X] T068 [US1] Write `packages/core/bench/node.ts` enforcing R22: typical validate+resolve ≤ 25 ms median, at-limit ≤ 250 ms, reject 10 MiB ≤ 5 ms, and re-resolution ≤ 4 ms
- [X] T069 [US1] Write `packages/core/test/determinism/cache-equivalence.test.ts` running every resolution fixture with caches at defaults, 0, and 1 and asserting byte-identical results (SC-C003)

**Checkpoint**: MVP. `conformance:core` passes all `resolve` fixtures, `sweeps:core` passes, `crosscheck:core` shows zero differences, and `bench:core` is within budget.

---

## Phase 4: User Story 2 - Untrusted, invalid, and hostile input never reaches the applied appearance (P1)

**Goal**: Per-source untrusted admission, the accessibility gate, and fail-closed identity
handling.

**Independent Test**: spec US2 scenarios 1–9 and SC-C005, SC-C007, SC-C012, and SC-C013.

### Tests for User Story 2

- [X] T070 [P] [US2] Write `packages/core/test/unit/admission/trust.test.ts`: missing trust → `trust-missing` with nothing parsed; plus a fast-check property over ≥ 1,000 generated documents showing that changing metadata, id, provenance, author, version, or `$extensions` never changes the reported trust (SC-C007)
- [X] T071 [P] [US2] Write `packages/core/test/unit/admission/source-gate.test.ts`: all four categories default `false`; missing, unknown, or disallowed category → `source-missing` / `source-unknown` / `source-not-allowed`; the stated category wins over contradicting provenance (SC-C012)
- [X] T072 [P] [US2] Write `packages/core/test/unit/admission/a11y-gate.test.ts`: an untrusted valid theme with a dark-mode `OT-A11Y-003` → `accessibility-gate` with diagnostics; the same bytes trusted → registered and reported; `relaxed` → registered with diagnostics (SC-C013) (in `packages/core/test/unit/admission/admission.test.ts`)
- [X] T073 [P] [US2] Write `packages/core/test/malicious/admission.test.ts` admitting every `conformance/fixtures/malicious/**` and `invalid/**` document as untrusted (source allowed) and asserting expected codes and zero selectable entries (SC-C005)
- [X] T074 [P] [US2] Write `packages/core/test/unit/registry/identity.test.ts`: `OT-SEC-001` and `OT-SEC-002` behavior with every admission order, baseline impostor, and base-shadow impostor
- [X] T075 [P] [US2] Write `packages/core/test/malicious/diagnostic-params.test.ts`: admit every document in `conformance/fixtures/malicious/**` and `conformance/fixtures/invalid/**` as untrusted (source allowed) and resolve it, then assert that no diagnostic `params` value and no operational error `message`, `hint`, or `pointer` contains any string of 3 or more characters taken from the document's string values or member names (the Foundation fixtures do not compare `params`, so this is Core's only check of FR-C086 and FR-071)

### Implementation for User Story 2

- [X] T076 [US2] Implement `CoreSettings` validation in `packages/core/src/settings.ts` with the defaults "`untrustedSources.*` `false`", "`accessibilityGate` `"enforce"`", "`registryCapacity` 256", "`cache.preparedThemes` 16", "`cache.results` 32"; unknown fields or out-of-range values → `invalid-argument`
- [X] T077 [US2] Implement source-category checks in `packages/core/src/admission/sources.ts`, run before any size check or parsing (research CR13 order)
- [X] T078 [US2] Implement the accessibility gate in `packages/core/src/admission/a11y-gate.ts` using `packages/core/src/validate/accessibility.ts` (refuse on any `OT-A11Y-003` for untrusted themes when `enforce`; never for trusted ones)
- [X] T079 [US2] Implement registry re-evaluation of validity and gates when the host declaration, a base, or source settings change (FR-C027, FR-C041) in `packages/core/src/registry/reevaluate.ts`
- [X] T080 [US2] Implement `registryCapacity` refusal (`registry-capacity`, never evicting silently) in `packages/core/src/registry/registry.ts`
- [X] T081 [US2] Implement `admitFrom(ThemeSource, …)` with `source-load-failed` in `packages/core/src/admission/source-load.ts` (in `packages/core/src/registry/registry.ts`)
- [X] T082 [US2] Record a security-focused review of `packages/core/src/{parse,admission,registry,canonical}/**` in `specs/002-core-runtime/checklists/security-review.md` (NFR-C005) (`specs/002-core-runtime/checklists/security-review.md`)

**Checkpoint**: US1 and US2 are complete. That is the P1 release candidate.

---

## Phase 5: User Story 3 - Adapters drive live context changes deterministically (P2)

**Goal**: A validated context model, fast re-resolution, and cross-runtime determinism.

**Independent Test**: every context-varying resolution fixture, repeated-call identity, and the
two-runtime suite (SC-C003).

### Tests for User Story 3

- [X] T083 [P] [US3] Write `packages/core/test/unit/resolve/context-input.test.ts`: `colorScheme` ∈ `light`/`dark`/`no-preference`, `contrast` ∈ `standard`/`high`, `textScale` > 0, `sizeClass` ∈ `compact`/`medium`/`expanded`, `direction` ∈ `ltr`/`rtl`; anything else, or any `density` or pixel-width member → `invalid-context`
- [X] T084 [P] [US3] Write `packages/core/test/determinism/runtime.test.ts` and a browser entry `packages/core/test/determinism/browser.ts` (reusing the `tools/bench` browser harness approach) that emit JCS hashes of every resolution fixture for comparison across the two runtimes (golden `test/determinism/hashes.json`; the page is `pnpm bench:core:browser`)

### Implementation for User Story 3

- [X] T085 [US3] Implement context validation in `packages/core/src/resolve/context-input.ts`, returning `{ ok: false, error: invalid-context }` with a pointer
- [X] T086 [US3] Implement the re-resolution fast path (reuse prepared themes; rerun stages 2–7 only) in `packages/core/src/resolve/prepare.ts` and `packages/core/src/core.ts`, verified by the 4 ms budget in `packages/core/bench/node.ts` (re-resolution 1.1 ms median; validation and mode evaluations are reused)
- [X] T087 [US3] Add `packages/core/bench/browser.ts` reusing `tools/bench/index.html` to report Core budgets in a browser engine (`packages/core/bench/browser.ts` builds one self-contained page; not yet run on the reference device)

**Checkpoint**: context changes meet 4 ms and are byte-identical across runtimes.

---

## Phase 6: User Story 4 - End user selects and personalizes within developer boundaries (P2)

**Goal**: The User Preferences document, the controller, preview, reset, and the persistence
abstraction.

**Independent Test**: quickstart scenarios 4 and 5, the `validate-preferences` fixtures, and
SC-C006.

### Tests for User Story 4

- [X] T088 [P] [US4] Write `packages/core/test/unit/preferences/document.test.ts`: the two validation levels, `OT-PREF-008` entries ignored but kept, and a canonical round trip that is byte-identical
- [X] T089 [P] [US4] Write `packages/core/test/controller/controller.test.ts`: one notification per byte-changing update, none for no-ops; preview publishes without writing; cancel restores prior bytes exactly; accept writes once; reset equals developer default with no values; `previous` updates only on `fallback: "none"`; selecting an invalid theme keeps the prior theme applied and the store unchanged (US2 scenario 6)
- [X] T090 [P] [US4] Write `packages/core/test/controller/store-failures.test.ts`: read and write failures → `store-read-failed` / `store-write-failed` with the result still correct; an unknown or newer document version → treated as absent and never overwritten; stale asynchronous completions discarded (`superseded`); stored bytes unchanged after every clamp, fallback, skip, and reject case (SC-C006)
- [X] T091 [P] [US4] Write `packages/core/test/quickstart/personalization.test.ts` implementing quickstart.md scenario 4
- [X] T092 [P] [US4] Write `packages/core/test/controller/import-export.test.ts`: `exportDocument()` returns canonical bytes equal to `preferences.serialize(document)` and never contains theme, policy, or host data; `importDocument` of a usable document replaces the document, writes exactly once, and republishes; `importDocument` of an unusable document (for example `OT-PREF-004`, `OT-PREF-005`) returns `imported: false` with diagnostics and leaves the document, the store, and the published result unchanged; a successful import cancels an active preview (FR-C068)

### Implementation for User Story 4

- [X] T093 [US4] Implement `parse` in `packages/core/src/preferences/parse.ts` with the fixed limits "65,536" bytes, "nesting depth 8", "512" values, "256 characters" per string, format range `1.0`–`1.N`, and `OT-PREF-001`…`009` (in `packages/core/src/preferences/document.ts`)
- [X] T094 [US4] Implement `compile` (to `selection`, `previous`, `preferences`, omitting `OT-PREF-008` entries) and `serialize` (JCS) in `packages/core/src/preferences/compile.ts` and `packages/core/src/preferences/serialize.ts` (`preferences/compile.ts`; serialization in `preferences/document.ts`)
- [X] T095 [P] [US4] Implement the `PreferenceStore` type and `createMemoryStore()` in `packages/core/src/controller/store.ts`
- [X] T096 [US4] Implement `ThemeController` in `packages/core/src/controller/controller.ts` following the data-model.md §10 state machine: synchronous `initial` document for first paint, generation counter, writes only on `select` / `setValue` / `clearValue` / `reset` / `acceptPreview`, `errors` list, `dispose`
- [X] T097 [US4] Implement preview state (never persisted) in `packages/core/src/controller/preview.ts`
- [X] T098 [US4] Implement `exportDocument()` and `importDocument(bytes)` in `packages/core/src/controller/controller.ts` as specified in `specs/002-core-runtime/contracts/public-api.md` (Export and import row), reusing `packages/core/src/preferences/parse.ts` and `packages/core/src/preferences/serialize.ts`
- [X] T099 [US4] Implement the harness `validate-preferences` kind in `packages/core-conformance/src/kinds/validate-preferences.ts`

**Checkpoint**: personalization works with no store, a memory store, and a failing store.

---

## Phase 7: User Story 5 - Output-target and adapter authors build on a stable, complete result (P2)

**Goal**: A minimal, typed, platform-free public surface.

**Independent Test**: a test consumer reads everything through public exports only (SC-C009).

- [X] T100 [P] [US5] Write `packages/core/test/api/consumer.ts` (a type-checked consumer using only `@opentheme/core` exports) and `packages/core/test/api/surface.test.ts` snapshotting the export list and failing if any exported type references DOM, Node, or framework types
- [X] T101 [P] [US5] Write `packages/core/test/api/resolved-schema.test.ts` validating every Core resolution result against `specification/schemas/1.0/resolved-theme.schema.json`
- [X] T102 [US5] Finalize `packages/core/src/index.ts` exports exactly as listed in `specs/002-core-runtime/contracts/public-api.md`, keeping kernels, parser, cache internals, and prepared structures unexported (with the additions recorded in `contracts/public-api.md`: `settings`, `updateSettings`, `ControllerOptions.snapshot`)
- [X] T103 [US5] Generate the typed API reference into `packages/core/api/core.api.md` with `packages/core/scripts/api-report.ts` from the declaration output, and fail CI on an unreviewed change

---

## Phase 8: User Story 6 - Versions evolve without silent incompatibility (P3)

**Goal**: Supported-version handling, migration, and the remaining document utilities.

**Independent Test**: every `versioning/*`, `inheritance/*`, `canonical/*` flatten, and
compare fixture through `conformance:core`, with zero `unsupported`.

- [X] T104 [P] [US6] Write `packages/core/test/unit/versioning/supported.test.ts`: a newer minor → `OT-VER-002`; another major → `OT-VER-001`; the simulated previous major migrated with `OT-VER-003`/`OT-VER-004` keeping the original trust
- [X] T105 [P] [US6] Write `packages/core/test/controller/theme-update.test.ts`: a theme update that removes a point skips its preference with `OT-CUS-104` without deleting it; standard points carry over between themes
- [X] T106 [US6] Implement supported ranges (`spec: ["1.0"]`, `preferences: ["1.0"]`) in `packages/core/src/versioning/supported.ts`
- [X] T107 [P] [US6] Implement theme-version classification (FR-084) in `packages/core/src/versioning/compare.ts`
- [X] T108 [P] [US6] Implement migration manifests (`rename-path`, `move-member`, `map-value`, `drop-member`) in `packages/core/src/versioning/migrate.ts`
- [X] T109 [P] [US6] Implement `flatten` (base-first merge, drop `extends`, lineage oldest first) and `exportCheck` (`OT-META-008`) in `packages/core/src/canonical/flatten.ts` and `packages/core/src/canonical/export-check.ts`
- [X] T110 [US6] Implement harness kinds `flatten`, `compare-versions`, and `migrate` in `packages/core-conformance/src/kinds/`, then confirm `conformance:core` reports zero `unsupported`

---

## Phase 9: User Story 7 - Developers and coding agents fix problems from diagnostics alone (P3)

**Goal**: Deterministic, capped diagnostics and a documented operational error vocabulary.

**Independent Test**: SC-C011 and US7 scenarios 1–3.

- [X] T111 [P] [US7] Write `packages/core/test/unit/diagnostics/order-cap.test.ts`: a theme with more than 200 findings gives exactly 200 in chapter 13 order plus `OT-LIM-099`, and identical lists on repeat
- [X] T112 [P] [US7] Write `packages/core/test/unit/errors/operational.test.ts`: every kind in `packages/core/src/errors/operational.ts` has a doc page, a hint, and a `docs` URL; no kind starts with `OT-`; thrown versus returned behavior matches the contract
- [X] T113 [US7] Write one page per operational error kind in `packages/core/docs/errors/<kind>.md` (what failed, why, and how to fix it)
- [X] T114 [US7] Implement the optional English message and hint templates module in `packages/core/src/diagnostics/templates.ts`, generated from the registry and excluded from the size budget

---

## Phase 10: Polish and cross-cutting concerns

- [X] T115 [P] Write `packages/core/README.md` (quickstart, trust model, settings, presets, persistence) and the agent guide `packages/core/AGENTS.md` (integration patterns, trust and source rules, common mistakes)
- [X] T116 Add `packages/core/test/docs/examples.test.ts`, which extracts every fenced `ts` code block from `packages/core/README.md` and `packages/core/AGENTS.md`, type-checks it against the built `@opentheme/core` declarations, and runs it, so a stale example fails `pnpm test` and therefore `pnpm verify` (constitution XI, NFR-C006)
- [X] T117 [P] Add the stress test `packages/core/test/stress/memory.test.ts` (10,000 admissions and 100,000 resolutions stay within the configured registry and cache bounds, SC-C010)
- [X] T118 [P] Extend `tools/kernel-crosscheck/crosscheck.py` to compare Core's kernel outputs with the Python reference (found and fixed finding F32)
- [X] T119 Run `pnpm size:core` and `pnpm bench:core` and record the measured results in `specs/002-core-runtime/research.md` (CR7, CR16)
- [X] T120 Run the full `pnpm verify` defined in `package.json`, fix any failures, and record the results (conformance count, Core test count, cross-check differences = 0) in `specs/002-core-runtime/checklists/requirements.md`

---

## Dependencies and execution order

- **Phase 1** P1, P2, and P3 are independent of each other; P4 follows them. The scaffold
  (T017–T025) can start in parallel with P1–P3, but T021 and T022 need P3's schema (T009).
- **Phase 2** depends on the scaffold. It blocks every story.
- **US1** (Phase 3) depends on Phase 2 and on P1 (selection rule) and P2 (sweeps).
- **US2** (Phase 4) depends on Phase 2. Its tests T073, T074, and T075 also use US1's `resolve`.
- **US3** depends on US1.
- **US4** depends on US1 and P3. T089 covers US2 scenario 6, so it also needs US2.
- **US5** depends on US1 and US4 (the final public surface).
- **US6** depends on Phase 2. It can run beside US3 and US4.
- **US7** depends on Phase 2. It can run beside any story.
- **Polish** depends on all stories.

```text
P1 ─┐
P2 ─┼─► Scaffold ─► Foundational ─► US1 ─┬─► US3
P3 ─┘      (P4 after P1–P3)          │   ├─► US4 ─► US5
                                     │   └─► (US2 tests)
                                     ├─► US2
                                     ├─► US6
                                     └─► US7 ─────────────► Polish
```

## Parallel examples

- **Phase 1**: T002, T004, T007, T009, T010, T012, T014, T015, and T016 touch different files.
- **Phase 2**: after T026, the pieces T027–T031 and T034–T042 can be built in parallel. Then
  T043 → T044 → T045 → T046.
- **US1**: tests T050–T052 together; T054 beside T055; then T056–T063 in stage order.
- **US2**: tests T070–T075 together; then T076 → T077 → T078 → T079.
- **US4**: tests T088–T092 together; T095 beside T093 and T094; T098 after T096.
- **US6 and US7** can run beside US3 and US4.

## Implementation strategy

1. **MVP (US1)**: Phase 1 → Phase 2 → US1. Stop and validate: quickstart scenario 1,
   `conformance:core` for `resolve`, and `crosscheck:core` = 0 differences. Trusted-only hosts can
   use this build.
2. **P1 release candidate**: add US2, the untrusted gates and security review.
3. **Incremental**: US3 (live context and performance), then US4 (personalization), then US5 (the
   frozen API surface).
4. **Completion**: US6 (zero `unsupported` in conformance), US7, then Polish and the full
   `pnpm verify`.

## Phase 11: Convergence

- [X] T121 Bring the at-limit admit+resolve median to 250 ms or less (Node bundled build measures 251–259 ms; desktop Chrome 384 ms) and then add `bench:core` to `pnpm verify` so the budget is enforced in CI, per NFR-C001 / SC-C008 (partial) (223–229 ms; `bench:core` is in `pnpm verify`)
- [X] T122 Type `ResolutionResult.resolved` as the schema-generated `ResolvedTheme` (packages/core/src/generated/types/ResolvedTheme.ts), export it and the generated `UserPreferences` type from `packages/core/src/index.ts`, and add a compile-time check that the hand-written `Diagnostic` type is assignable to the schema-generated one, per FR-C104 (partial)
- [X] T123 Accept previous-major theme documents at admission only through a host-supplied migration manifest inside the published deprecation window (reporting `OT-VER-003`/`OT-VER-004` and keeping the original admission's trust), with tests in `packages/core/test/unit/admission/`, per FR-C101 (missing)
- [X] T124 Ship the JSON Schemas Core consumes (theme, host declaration, resolution input, resolved theme, diagnostic, user preferences) in the published package (`packages/core/package.json` `files`, e.g. `schemas/`) and reference them from README.md, per NFR-C006 (partial)
- [ ] T125 Run `pnpm bench:core:browser` on the named mid-range reference phone and record determinism and the 100 ms / 1 s budgets in `specs/002-core-runtime/checklists/requirements.md`, per NFR-C004 / NFR-C001 (partial)
