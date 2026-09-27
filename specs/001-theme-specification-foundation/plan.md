# Implementation Plan: Theme Specification and Theme Foundation

**Branch**: `001-theme-specification-foundation` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-theme-specification-foundation/spec.md`

## Summary

This feature delivers the OpenTheme Theme Specification 1.0 (FR-099), not the runtime. It consists
of:

- normative prose;
- JSON Schemas;
- data registries for every closed vocabulary;
- the always-valid specification baseline theme;
- at least two production-quality reference themes, which are also the first official prebuilt
  themes;
- two reference host declarations;
- a conformance suite, including valid, invalid, and malicious fixtures, resolution examples,
  versioning fixtures, accessibility sweeps, and numeric-kernel golden vectors.

A theme is a declarative I-JSON document with the following design (research R1 to R19):

- **Tokens** use DTCG-aligned syntax. A theme needs only seeds (background, foreground, accent,
  and font family); every other value comes from specification defaults derived from the seeds.
  The high-contrast mode is always present.
- **Derived values** use a closed set of 16 deterministic transformations. They are computed in
  OKLab with normative numeric kernels, so results are bit-identical across languages.
- **Context overlays** vary values by color scheme, contrast, motion, density, and size class.
- **Component styling** is keyed to versioned contracts: a 14-contract standard catalog plus
  host-declared extensions.
- **Customization points** accept type-aware constraints (clamp, snap, or fall back; preferences
  are never modified).
- **Resolution** is a pure 7-stage algorithm that preserves the constitution's order of authority.
- **Diagnostics** are structured, with stable codes and JSON Pointer locations.

A private, non-normative TypeScript reference checker (`ot-ref`) and a Python kernel cross-check
exist only to author and verify these artifacts. The production core is a later feature developed
independently against the specification.

## Technical Context

**Language/Version**:

- Deliverables are data and prose: JSON restricted to I-JSON (RFC 7493), JSON Schema draft
  2020-12, and Markdown (CommonMark).
- Verification tooling uses TypeScript 6.0 on Node.js 24 LTS; the CI matrix adds Node.js 26.
- Python 3.13 (standard library only) is used solely for the numeric-kernel cross-check.

**Primary Dependencies**:

- Ajv 8 (draft 2020-12) is the only runtime dependency of the reference checker library. It
  shows that the schemas run on mainstream validators (NFR-009).
- SHA-256 uses Web Crypto. The I-JSON tokenizer and JCS serializer are written in-house (research
  R3, R14).
- Development only: Vitest, fast-check, Biome, markdownlint-cli2, and json-schema-to-typescript.

**Storage**: N/A. All artifacts are files in the repository, with no database or network.

**Testing**:

- Vitest unit tests.
- fast-check property tests of transformations (totality, determinism, domains) and parser
  robustness.
- The conformance runner: fixtures, golden-output resolution, canonical round trips, versioning,
  and kernel vectors.
- Accessibility sweeps (SC-006, SC-014, SC-015).
- The Python kernel cross-check.
- `spec-lint`: consistency, traceability, domain-term and capability scans, and example
  verification.
- Benchmarks.

**Target Platform**:

- The specification is platform-neutral.
- Tooling runs on Linux, macOS, and Windows with Node.js 24 or later.
- The reference checker library runs in evergreen browsers for the phone benchmark.

**Project Type**: A specification and conformance suite (data and documentation deliverables), with
private verification tooling (a library and a CLI). It is not a runtime product, adapter, or output
target.

**Performance Goals**: SC-010 and NFR-003: on a mid-range phone, a typical theme validates in
100 ms or less, and a theme at the resource limits in 1 s or less. CI proxy budgets on x86-64
(research R22):

| Case | Median budget |
|---|---|
| Validate and resolve a typical theme (1,000 tokens) | ≤ 25 ms |
| Validate and resolve a theme at the resource limits | ≤ 250 ms |
| Reject a 10 MiB document (size check before parsing) | ≤ 5 ms |
| Re-resolve after a context change | ≤ 4 ms |

Before release, the browser benchmark runs on a named mid-range Android reference device to
confirm the phone budgets directly.

**Constraints**:

- Everything works offline, without accounts or services (NFR-004, Principle XII).
- Results are bit-identical across implementations: only IEEE binary64 basic operations, no FMA,
  normative kernels, round-half-even quantization, and JCS output (NFR-001).
- Fixed resource limits and an effort budget of 200,000 units per mode (research R15).
- Specification vocabulary is domain-neutral (FR-088).
- The specification never depends on the reference checker; the conformance suite defines
  expected outcomes.
- Parser and untrusted-input changes need a security-focused review (Principle VI).

**Scale/Scope**:

- 99 functional requirements, 10 non-functional requirements, 15 success criteria, and 8 user
  stories.
- 18 normative chapters, 9 registries, and 7 standard customization points.
- 5 context dimensions, 16 transformations, and 14 standard contracts.
- The baseline theme, 2 or more reference themes, and 2 reference hosts.
- Fixtures: at least 1 per normative rule, per forbidden-content category, and per resource
  limit. Resolution examples cover 10 layer pairs × 5 dimensions, FB-001 to FB-013, and the US3
  and US4 scenarios. Sweeps cover at least 1,000 accents and at least 1,000 seed combinations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Before research (against spec.md)

| # | Gate | Status | Basis |
|---|---|---|---|
| 1 | Separation (I) | Pass | Themes express presentation only. FR-066 and FB-009 forbid code, conditions, data access, and addresses; FR-088 requires domain-neutral vocabulary |
| 2 | Personalization (II) | Pass | Customization points (FR-040 to FR-045) and precedence layers (FR-050 to FR-052) model user changes as preference overrides, not theme forks |
| 3 | Boundaries (III) | Pass | Points grant nothing by default (FR-043); developer policy is the final authority over theme and user layers (FR-050, FR-051) |
| 4 | Specification (IV) | Pass | The feature is the specification itself: schema, rules, and fixtures (FR-001 to FR-003, FR-099) |
| 5 | Agnostic core (V) | Pass | The format is platform-neutral, and no core or adapter is built here |
| 6 | Security (VI) | Pass | Fail-closed validation, fixed limits, no partial application, no external resources, trust and identity rules, literal-only diagnostics (FR-059 to FR-071) |
| 7 | AI (VII) | Pass | AI produces ordinary theme documents under the same validation (US8, FR-090 to FR-093, FR-097); no AI service is designed |
| 8 | Accessibility (VIII) | Pass | AA and high-contrast guarantees, forced colors, reduced motion, text scaling, RTL logical values, target size, and responsive dimensions (FR-020, FR-024 to FR-027, FR-038, FR-039, FR-052 to FR-054, FR-072 to FR-078). Budgets are required below |
| 9 | Compatibility (IX) | Pass | SemVer, additive 1.x, deprecation diagnostics, previous-major reading, and migrations (FR-079 to FR-086) |
| 10 | Determinism (X) | Pass | Pure resolution with injected context and a single expected result per example (NFR-001, FR-058) |
| 11 | Developer experience (XI) | Pass | Machine-readable specification, actionable diagnostics, and annotated examples (FR-090 to FR-093, NFR-006) |
| 12 | No required cloud (XII) | Pass | Offline validation and resolution (NFR-004); open implementation (NFR-009) |
| 13 | Extensibility (XIII) | Pass | Namespaced extensions with concrete consumers (host contracts, provenance); no speculative extension points |

### After design (against research.md, data-model.md, and contracts/)

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Separation (I) | Pass | The schemas have no field able to hold code, selectors, conditions, or addresses ([theme-document.md](./contracts/theme-document.md) "Forbidden content"). A capability scan runs in `spec:check`. Reference hosts use only generic presentation contracts |
| 2 | Personalization (II) | Pass | Standard and theme-declared customization points plus the user-value state model (data-model §9); stored preferences are never modified ([resolution.md](./contracts/resolution.md) stage 4) |
| 3 | Boundaries (III) | Pass | Resolution stage order: specification defaults, theme, permitted preferences, developer policy (locks, protected tokens, floors), then platform accessibility. Undeclared points are skipped (`OT-CUS-103`) |
| 4 | Specification (IV) | Pass | Every capability has a schema, a registry entry, a rule in `rules.json`, and fixtures. Traceability is enforced by `spec:check` ([registries.md](./contracts/registries.md)) |
| 5 | Agnostic core (V) | Pass | Dimensions resolve to `px`; no platform or framework concept appears. The reference checker library uses no Node-only or DOM APIs (R18) |
| 6 | Security (VI) | Pass | Size check before parsing, in-house I-JSON tokenizer, bounded effort model, identity-collision handling (`OT-SEC-*`), literal-only diagnostic parameters, and malicious fixtures per category and limit (R14, R15, [diagnostics.md](./contracts/diagnostics.md)) |
| 7 | AI (VII) | Pass | `llms.txt` links only schemas, registries, and examples. The AI evaluation protocol is outside CI and outside every package (R20). No AI endpoint or service is defined |
| 8 | Accessibility (VIII) | Pass | Exact WCAG 2.2 contrast (R8), seed-derived AA defaults and an always-present high-contrast mode (R10), accessibility floor at resolution (R12), forced-colors registry, reduced-motion and target-size floors, logical directions, and sweeps in CI. Budgets are in Performance Goals. First paint is supported: resolution is synchronous, pure, and uses injected context, so hosts can resolve during server-side rendering |
| 9 | Compatibility (IX) | Pass | `opentheme: MAJOR.MINOR` targeting, a declarative migration manifest, a simulated previous-major profile, the theme-version comparison procedure (FR-084), and deprecation diagnostics `OT-VER-005` (R16) |
| 10 | Determinism (X) | Pass | Normative kernels with golden vectors and a cross-language check (R7), JCS output, and fixed diagnostic ordering. The mandatory test suites are planned below |
| 11 | Developer experience (XI) | Pass | Types generated from schemas; `ot-ref` is non-interactive with JSON output and exit codes; `AGENTS.md` and `llms.txt`; examples verified in CI; the quickstart runs in CI |
| 12 | No required cloud (XII) | Pass | All tooling and checks run offline. The runner protocol uses stdio only. No telemetry |
| 13 | Extensibility (XIII) | Pass | Extension points are limited to `$extensions` namespaces, host contracts, and the DTCG mapping. Each has a concrete consumer (reference hosts, round trips, FR-096). A proposed `contractDefaultsOverride` was removed as speculative |

**Result**: All 13 gates pass. There are no violations, so Complexity Tracking is empty.

**Open governance items** (not design gates, but 1.0.0 release gates):

- `TODO(LICENSE)`: reference themes carry `LicenseRef-OpenTheme-Pending`, which
  `release:check` rejects. The license must be OSI-approved (Principle XII).
- `TODO(MAINTAINERS)`.

## Mandatory test coverage (for `/speckit-tasks`)

Principle X makes tests mandatory for the specification, schemas, policy enforcement, migrations,
and untrusted input. `tasks.md` must include test tasks for each suite below.

| Constitution suite | This feature |
|---|---|
| Specification conformance (valid and invalid) | `conformance/fixtures/valid`, `invalid`, `examples`, `canonical`, `inheritance` |
| Golden-output resolution | `conformance/fixtures/resolution`: layer-pair × dimension matrix, FB-001 to FB-013, US3 and US4 scenarios, text scale |
| Policy enforcement | Resolution fixtures for the abstract developer-policy layer: locks, protected tokens, permitted points, accessibility floor, relaxed-policy diagnostics |
| Malicious input | `conformance/fixtures/malicious`, plus parser property and fuzz tests in the reference checker |
| Migration | `conformance/fixtures/versioning`: 1.x compatibility, deprecation, and the simulated previous major |
| Accessibility checks for official themes | SC-006 report and the SC-014 and SC-015 sweeps, run in CI on the baseline and reference themes |
| Adapter conformance | N/A: no adapter exists in this feature. The runner protocol is the future basis |
| Determinism (supporting) | Kernel golden vectors, the Python cross-check, and fast-check properties of transformations |

Visual regression tests on reference components (a Principle X SHOULD) are deferred to the first
output-target feature, because this feature renders nothing.

## Project Structure

### Documentation (this feature)

```text
specs/001-theme-specification-foundation/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R22
├── data-model.md        # Phase 1: entities, fields, validation, state transitions
├── quickstart.md        # Phase 1: how to verify the deliverables
├── contracts/           # Phase 1: normative shapes the artifacts must follow
│   ├── theme-document.md
│   ├── host-declaration.md
│   ├── transformations.md
│   ├── resolution.md
│   ├── diagnostics.md
│   ├── registries.md
│   └── conformance.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created by /speckit-plan)
```

### Source Code (repository root)

```text
specification/                         # published, normative deliverables (FR-099)
├── spec/
│   ├── 00-introduction-and-conformance.md
│   ├── 01-document-format.md          # I-JSON, canonical form, integrity
│   ├── 02-metadata-and-identity.md
│   ├── 03-tokens.md
│   ├── 04-transformations.md
│   ├── 05-numeric-kernels.md
│   ├── 06-contexts-and-modes.md
│   ├── 07-semantic-baseline-and-defaults.md
│   ├── 08-components-and-layout.md
│   ├── 09-customization-points.md
│   ├── 10-inheritance-and-resolution.md
│   ├── 11-accessibility.md
│   ├── 12-security-and-limits.md
│   ├── 13-diagnostics.md
│   ├── 14-versioning-and-migration.md
│   ├── 15-extensions-and-provenance.md
│   ├── 16-design-tokens-mapping.md
│   └── 17-host-declarations.md
├── schemas/1.0/
│   ├── theme.schema.json              # composes defs/
│   ├── defs/                          # metadata, display-text, seeds, tokens, derivation,
│   │                                  # contexts, components, customization, layout
│   ├── host-declaration.schema.json
│   ├── resolution-input.schema.json
│   ├── resolved-theme.schema.json
│   ├── diagnostic.schema.json
│   ├── migration-manifest.schema.json
│   ├── fixture.schema.json
│   └── registry/                      # one schema per registry file
├── registry/1.0/                      # semantic-baseline, component-catalog, customization-points,
│                                      # context-dimensions, transformations, forced-colors,
│                                      # limits, diagnostics, rules
├── themes/
│   ├── baseline/                      # org.opentheme.baseline (always valid)
│   └── reference/                     # ≥ 2 official prebuilt themes: light, dark, high contrast
├── hosts/                             # 2 reference host declarations (notes-style, media-style)
├── examples/                          # annotated minimal → full-featured; invalid with diagnostics
├── llms.txt                           # agent entry point: schemas, registries, examples
└── CHANGELOG.md

conformance/                           # see contracts/conformance.md
├── fixtures/                          # valid, invalid, malicious, resolution, canonical,
│                                      # inheritance, versioning, examples, kernels
├── sweeps/                            # SC-014 and SC-015 generator parameters
└── runner/                            # implementation-agnostic NDJSON runner

tools/                                 # private, non-normative, not published
├── reference-checker/                 # TypeScript library + `ot-ref` CLI
│   ├── src/
│   │   ├── parse/                     # bounded I-JSON tokenizer, size check (security review)
│   │   ├── canonical/                 # normalization, JCS, integrity
│   │   ├── schema/                    # Ajv integration, x-opentheme-code mapping
│   │   ├── kernels/                   # normative numeric kernels
│   │   ├── color/                     # OKLab, gamut mapping, quantization, contrast
│   │   ├── transforms/                # the 16 transformations and effort accounting
│   │   ├── validate/                  # references, derivations, overlays, contracts, a11y
│   │   ├── resolve/                   # 7-stage resolution, fallback chain
│   │   ├── versioning/                # compare, migrate
│   │   ├── diagnostics/
│   │   └── cli/
│   └── test/                          # unit/, property/
├── types/                             # TypeScript types generated from specification/schemas
├── kernel-crosscheck/                 # Python 3.13, standard library only
├── spec-lint/                         # consistency, traceability, scans, example verification
└── bench/                             # Node and browser benchmarks

evaluations/                           # manual, pre-1.0.0; not in CI, not a dependency
├── diagnostic-review/                 # SC-005
├── authoring-timing/                  # SC-007
├── ai-generation/                     # SC-008 (provider-agnostic script)
├── resolution-prediction/             # SC-009
└── vocabulary-review/                 # SC-012

AGENTS.md                              # agent guide for contributors
package.json                           # scripts: build, test, spec:check, conformance, sweeps,
pnpm-workspace.yaml                    #   kernels:crosscheck, bench, bench:browser, verify,
biome.json                             #   release:check
.markdownlint-cli2.jsonc
tsconfig.base.json
```

**Structure Decision**: The repository is specification-first. `specification/` holds everything
normative and published. `conformance/` defines expected outcomes for any implementation.
`tools/` holds private workspace packages that verify both but are never normative or published.
`evaluations/` holds manual protocols for success criteria that involve people or models. There
are no `src/` application packages: the core, output targets, and adapters are later features.
The CI provider's workflow only calls `pnpm verify`, which runs the quickstart's automated sections
2–5 and 7. The CI configuration therefore stays provider-neutral, and everything runs locally
offline.

## Complexity Tracking

No constitution violations. Nothing to justify.
