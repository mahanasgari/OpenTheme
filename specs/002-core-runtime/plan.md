# Implementation Plan: OpenTheme Core Runtime

**Branch**: `002-core-runtime` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-core-runtime/spec.md` (clarified 2026-09-25,
five answers)

## Summary

Build `@opentheme/core`: a framework-agnostic, synchronous, dependency-free TypeScript library
that admits theme and host documents with host-assigned per-document trust, gates untrusted
admissions by host-enabled source category and by WCAG 2.2 AA, keeps an immutable registry,
and resolves through an **independent** implementation of the Foundation's normative
resolution algorithm. It also provides an optional stateful controller (context, selection,
preferences, preview, reset, subscriptions), persists personalization as a new versioned **User
Preferences document** through an injectable store, and returns Foundation diagnostics plus a
Core-versioned operational error vocabulary.

Correctness is proven by passing the unchanged Foundation conformance suite through the runner
protocol and by agreeing byte for byte with the reference checker. Performance meets research
R22 exactly. Four small, additive Foundation changes come first (P1–P4 in
[research.md](./research.md)).

## Technical Context

**Language/Version**: TypeScript 6.0 compiled to ES2022, ESM only. Node.js 24 and 26 for
development and CI (research CR1).

**Primary Dependencies**: None at runtime. Build only: Ajv 8 (standalone validator generation,
CR4) and json-schema-to-typescript (types, CR17). Test only: Vitest 3 and fast-check 4.

**Storage**: None in Core. An injectable `PreferenceStore`; Core ships only an in-memory store
(FR-C091).

**Testing**: The Foundation conformance runner (`--impl` Core harness), a Core ↔ reference
checker byte cross-check, Vitest unit, property, and malicious suites, cache-equivalence and
two-runtime determinism suites, and benchmarks (CR15).

**Target Platform**: Any ES2022 engine without platform APIs: Node, Deno, and Bun servers,
evergreen browsers, and React Native Hermes (CR1).

**Project Type**: Library (plus a private conformance harness).

**Performance Goals**: Research R22 as written: typical validate plus resolve ≤ 25 ms median,
at-limit ≤ 250 ms, reject 10 MiB ≤ 5 ms, re-resolution after a context or preference change
≤ 4 ms (CI x86-64); 100 ms and 1 s on the reference phone (NFR-C001).

**Constraints**: Synchronous resolution with no I/O. Deterministic byte output. No platform
math. No `eval` or `new Function`. Bundle ≤ 100 KB min+gzip (CR16). Offline. No telemetry.

**Scale/Scope**: Themes up to the specification limits (10,000 tokens, 1 MiB). Registry default
256 entries. Caches of 16 prepared themes and 32 results by default. Preferences documents
≤ 64 KiB and ≤ 512 values.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Pre-research | Post-design | Evidence |
|---|---|---|---|---|
| 1 | Separation (I) | Pass | Pass | No business or domain vocabulary; Core outputs only the Resolved Theme (FR-C003, FR-C004) |
| 2 | Personalization (II) | Pass with a recorded deviation | Pass with a recorded deviation | Preferences are a separate, versioned, serializable document (FR-C067); reset and preview exist; Core never transmits preferences. **Deviation**: the required local on-device store is not in Core (see Complexity Tracking) |
| 3 | Boundaries (III) | Pass | Pass | Every input path (API, import, AI sources) goes through admission gates and the normative policy layer. Defaults are closed (the `closed` preset; all untrusted sources off). One-setting adoption through presets (CR14) |
| 4 | Specification (IV) | Pass | Pass | No new theme capability. The new preferences contract is specified (schema, chapter 18, fixtures) before Core relies on it (P3). The unversioned-selection rule goes into chapter 10 first (P1) |
| 5 | Agnostic core (V) | Pass | Pass | No framework, DOM, or platform dependency (CR1, SC-C009). Independent versioning (CR17). Adapter conformance comes later, with Core as the oracle |
| 6 | Security (VI) — non-negotiable | Pass | Pass | Explicit per-document trust (F1 fixed); untrusted by default; bounded parser (CR3); limits; fail closed; no code execution, including validators (CR4); protected tokens through policy; previews never persist; malicious fixtures and a security review (NFR-C005) |
| 7 | AI (VII) — non-negotiable | Pass | Pass | Core has no AI provider. AI-generated themes are an untrusted source category with no bypass (FR-C024–FR-C028) |
| 8 | Accessibility (VIII) | Pass | Pass | Normative platform-accessibility layer; AA floor for user values; the untrusted-theme AA gate on by default (FR-C028); synchronous first paint (FR-C092); budgets benchmarked (CR7) |
| 9 | Compatibility (IX) | Pass | Pass | SemVer for the API, the preferences format, and supported specification versions; deprecation window; migration hooks for the previous major (FR-C068, FR-C101) |
| 10 | Determinism (X) | Pass | Pass | Pure resolve, injected context, no clock or randomness, cache invisibility tests, cross-runtime tests, and all mandatory suites planned (CR15) |
| 11 | Developer experience (XI) | Pass with a recorded deviation | Pass with a recorded deviation | Typed API generated from the schemas; operational errors with docs links; a runnable quickstart in CI; an agent guide (P4). **Deviation**: the quickstart cannot yet "connect one adapter" (see Complexity Tracking) |
| 12 | No required cloud (XII) — non-negotiable | Pass | Pass | Fully offline; no telemetry (NFR-C003, NFR-C007) |
| 13 | Extensibility (XIII) | Pass | Pass | New seams (ThemeSource, PreferenceStore, presets, harness) each have a concrete consumer: the quickstart, the controller, and conformance. No speculative plug-in API |

No gate for a non-negotiable principle (I, VI, VII, XII) has any exception.

## Delivery Phases (input to `/speckit-tasks`)

| Phase | Content | Exit criterion |
|---|---|---|
| **0: Foundation prerequisites** | P1 selection errata; P2 runner sweeps over the protocol; P3 User Preferences contract (chapter 18, schema, `OT-PREF-*`, `R-PREF-*`, fixtures, `validate-preferences` in the runner and reference checker, types); P4 AGENTS.md and `llms.txt` | `pnpm verify` green; security review recorded for P3 |
| **1: Scaffold** | `packages/core`, `packages/core-conformance`, workspace glob, build pipeline for generated artifacts (validators, registries, baseline, types) with freshness checks, import-graph and platform-API lint, size check | Empty harness handshake passes; freshness and size checks run in CI |
| **2: Admission (US2 core)** | Parser, limits, schema and semantic validation, canonical form and SHA-256, trust and source gates, accessibility gate, registry and snapshots | `validate`, `validate-host`, `canonicalize`, `export-check`, and `kernel` fixtures pass through the harness |
| **3: Resolution (US1, US3)** | Prepared themes, stages 1–7, presets, `listSelectable`, `describeCustomization`, memoization | All `resolve` fixtures, sweeps, and cross-check pass; `bench:core` within budget |
| **4: Personalization (US4)** | Preferences document API, controller, preview, reset, memory store, store-failure handling | Scenario 4 and 5 tests; `validate-preferences` fixtures |
| **5: Versions and utilities (US6)** | `flatten`, `compare-versions`, `migrate`, supported-range checks | Remaining fixture kinds pass; zero unsupported |
| **6: Hardening and docs (US5, US7)** | Two-runtime determinism, cache equivalence, malicious suites, operational error docs, agent guide, typed API reference, quickstart as a test | All SC-C criteria verified; `pnpm verify` green |

## Project Structure

### Documentation (this feature)

```text
specs/002-core-runtime/
├── spec.md
├── plan.md                  # this file
├── research.md              # CR1–CR17, Foundation prerequisites P1–P4
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── public-api.md
│   ├── user-preferences-document.md
│   ├── operational-errors.md
│   └── conformance-harness.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/
├── core/                              # @opentheme/core (published, 0.x)
│   ├── src/
│   │   ├── index.ts                   # public exports only (contracts/public-api.md)
│   │   ├── admission/                 # size check, parser, validate, trust and source gates, a11y gate
│   │   ├── parse/                     # bounded I-JSON tokenizer (security review scope)
│   │   ├── validate/                  # schema-diagnostic mapping, semantic rules
│   │   ├── canonical/                 # JCS, SHA-256, integrity, flatten, export-check
│   │   ├── registry/                  # entries, snapshots, identity rules
│   │   ├── resolve/                   # prepared themes, stages 1–7, selection, presets
│   │   ├── kernels/                   # chapter 05 binary64 kernels (no platform math)
│   │   ├── color/                     # OKLab, gamut, contrast, quantize
│   │   ├── preferences/               # User Preferences document parse, compile, serialize
│   │   ├── controller/                # ThemeController, memory store
│   │   ├── versioning/                # supported ranges, compare, migrate
│   │   ├── errors/                    # operational error kinds
│   │   └── generated/                 # validators, registries, baseline, types (build output, checked in)
│   ├── test/{unit,property,malicious,determinism,controller,quickstart}/
│   ├── bench/
│   └── package.json
└── core-conformance/                  # private NDJSON harness (contracts/conformance-harness.md)

specification/                         # Foundation (prerequisite P3 additions only)
├── spec/18-user-preferences.md
├── schemas/user-preferences/1.0/user-preferences.schema.json
└── registry/1.0/{diagnostics,rules}.json   # PREF entries added

conformance/
├── fixtures/preferences/              # P3
└── runner/src/…                       # P2 sweeps over the protocol; P3 validate-preferences

tools/
├── reference-checker/src/…            # P1 pickEntry fix; P3 validate-preferences (non-normative)
├── spec-lint/src/…                    # schemas/user-preferences walk; Core freshness, import graph
└── types/scripts/generate.ts          # second output for packages/core
```

**Structure Decision**: a pnpm workspace with a new `packages/*` glob. The single published
library is `@opentheme/core`, with its private harness beside it. Foundation directories change
only through the additive prerequisites P1–P4.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution II: "at least one local (on-device) implementation" of preference storage is not shipped by Core | On-device storage is platform-specific (browser storage, file system, React Native storage), and Core must not use platform APIs (V, FR-C001) | Putting a browser-storage store in Core would break the framework- and platform-agnostic core. **Owner**: the first adapter or output-target feature. **Remediation**: that feature ships a local store implementing `PreferenceStore`, and its plan's Constitution Check verifies it |
| Constitution XI: the quickstart "connecting one adapter" cannot run yet | No adapter exists; adapters are later features | Writing a throwaway adapter here violates the spec's out-of-scope list. **Owner**: the first adapter feature. **Remediation**: extend the CI quickstart to include that adapter |
| Foundation changes (P1–P4) inside a Core feature | Core cannot implement unversioned selection, sweeps, or persistence correctly without them (clarifications 1, 3, 4) | Implementing Core-only rules would create a second normative source (spec FR-C034, FR-C069). Each prerequisite is additive and verified separately |
