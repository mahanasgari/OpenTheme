# Implementation Plan: OpenTheme Web Adapter

**Branch**: `003-web-adapter` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-web-adapter/spec.md`

## Summary

Build `@opentheme/web`, the first platform adapter over `@opentheme/core`. It serializes Core's
Resolved Theme into CSS custom properties under an injective, versioned naming contract, applies
them per scope through one CSS-object-model rule (server-renderable and CSP-friendly), feeds Core's
controller live browser context from media features and `lang`/`dir`, and persists preferences in
per-origin storage with a synchronous first read. All theming behavior stays in Core; the adapter
only translates. An output-target conformance check decodes the CSS back and compares it with
Core's result for every resolution fixture (research WR1–WR10).

## Technical Context

**Language/Version**: TypeScript 6 targeting ES2022 (ESM), like Core

**Primary Dependencies**: `@opentheme/core` (peer, runtime); dev only: Vitest, `happy-dom`,
esbuild (size check)

**Storage**: per-origin browser key-value storage (`localStorage`) through Core's
`PreferenceStore` interface; hosts may supply their own

**Testing**: Vitest with `happy-dom` for DOM behavior; output-target conformance over Core's
resolution fixtures; the existing browser page extended for real-browser timing

**Target Platform**: current evergreen browsers; the pure output functions also run in Node for
server rendering

**Project Type**: library (workspace package `packages/web`)

**Performance Goals**: apply a typical theme ≤ 4 ms median; context-change update including Core
re-resolution ≤ 4 ms median (SC-W006)

**Constraints**: ≤ 10 KB gzip over Core; no runtime dependency besides Core; no framework; no
code execution from themes; CSP-friendly writes

**Scale/Scope**: about 500 declarations for a typical theme; several scopes per page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Pre-research | Post-design | Evidence |
|---|---|---|---|---|
| 1 | Separation (I) | Pass | Pass | Presentation only: writes CSS variables; no business behavior |
| 2 | Personalization (II) | Pass | Pass | Provides the required local on-device store (WR6), closing Core's recorded deviation; live updates without reload (WR5) |
| 3 | Boundaries (III) | Pass | Pass | Policy and presets pass through to Core unchanged |
| 4 | Specification (IV) | Pass | Pass | No new theme capability; Foundation gaps W1 and W2 recorded, not worked around silently |
| 5 | Thin adapters (V) | Pass | Pass | No validation, resolution, or policy logic; independent package; output-target conformance with Core as oracle (WR7) |
| 6 | Security (VI), non-negotiable | Pass | Pass | Only typed values are written through fixed serializers; names outside the grammar are omitted; family names quoted and escaped; no evaluation of theme content (WR3, WR10) |
| 7 | AI (VII), non-negotiable | Pass | Pass | No AI surface; AI-generated themes reach the adapter only through Core's gates |
| 8 | Accessibility (VIII) | Pass | Pass | Honors contrast, forced colors, reduced motion, and text scale; flash-free first paint (WR4, WR6); budgets benchmarked (WR9) |
| 9 | Compatibility (IX) | Pass | Pass | The CSS output contract is versioned; breaking name or format changes require a major |
| 10 | Determinism (X) | Pass | Pass | Deterministic declaration order and number formatting; conformance tests |
| 11 | Developer experience (XI) | Pass | Pass | README quickstart as a CI test, agent guide, typed API; also completes Core's "connect one adapter" quickstart deviation |
| 12 | No required cloud (XII), non-negotiable | Pass | Pass | Fully local; preferences never transmitted (FR-W023) |
| 13 | Extensibility (XIII) | Pass | Pass | Seams (host store, helpers) each have a consumer; no plug-in API |

No gate for a non-negotiable principle (I, VI, VII, XII) has any exception.

## Foundation Findings

Recorded per FR-W043; the adapter does not change Foundation or Core behavior.

| # | Finding | Adapter handling | Proposed resolution |
|---|---|---|---|
| W1 | Host declarations do not constrain contract, part, property, or variant names (`host-declaration.schema.json` accepts any non-empty string), unlike the standard catalog's `[a-z][a-z0-9-]*` | Paths with a segment outside the grammar are omitted and reported | Chapter 17 errata: those names use the token-segment grammar, with a host rule and fixtures |
| W2 | The host schema allows a `gradient` property type that no chapter, registry, or Core defines | Values of that shape are omitted and reported | Remove `gradient` from the host schema, or specify it in chapters 03 and 08 |
| W3 | Chapter 03 requires token path segments to match `[a-z][a-z0-9-]*`, but the semantic baseline registry defines `space.0` to `space.9`, which Core resolves | The naming grammar accepts `[a-z0-9][a-z0-9-]*`; still injective because no segment contains `_` | Chapter 03 errata: allow digit-led segments (`[a-z0-9][a-z0-9-]*`), or rename the baseline spacing tokens in a major version |

## Delivery Phases (input to `/speckit-tasks`)

| Phase | Content | Exit criterion |
|---|---|---|
| **1: Scaffold** | `packages/web` package, build, test setup with `happy-dom`, workspace wiring, boundary lint (no framework imports, Core only), `size:web` | Empty test suite runs; size check in CI |
| **2: Output (US1, US5)** | Naming, serializers, `toDeclarations`, `toStylesheet`, decoder and `conformance:web` | Conformance passes on every resolution fixture; malicious suite passes |
| **3: Scopes (US1)** | `attachTheme`, style element and rule, diffing, adoption of server-rendered elements, teardown, scope conflicts | Quickstart scenario 1 and 5 tests |
| **4: Context (US2)** | Media features, `lang`/`dir` observation, host inputs, helpers, change detection | Scenario 3 tests |
| **5: Persistence (US3, US4)** | Browser store, synchronous initial read, failure handling | Scenario 4 tests |
| **6: Hardening and docs** | README and agent guide with CI-run examples, `bench:web`, browser page, findings W1–W2 filed | `pnpm verify` green with the web gates |

## Project Structure

### Documentation (this feature)

```text
specs/003-web-adapter/
├── spec.md
├── plan.md              # this file
├── research.md          # WR1–WR10
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── css-output.md    # naming and serialization contract
│   └── public-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/web/
├── package.json         # @opentheme/web; peer dependency @opentheme/core
├── src/
│   ├── naming.ts        # path → custom property name (WR2)
│   ├── serialize.ts     # typed resolved value → CSS text (WR3)
│   ├── declarations.ts  # toDeclarations, omissions (WR10)
│   ├── stylesheet.ts    # toStylesheet (server rendering)
│   ├── scope.ts         # attachTheme, style element, diffing, teardown (WR4)
│   ├── context.ts       # browser context source and helpers (WR5)
│   ├── store.ts         # createBrowserStore (WR6)
│   └── index.ts
├── test/                # unit, DOM, conformance (with the decoder), malicious, quickstart, docs
├── bench/               # bench:web
├── README.md
└── AGENTS.md
```

**Structure Decision**: One new workspace package beside `packages/core`, following Core's layout
and tooling. Root scripts gain `conformance:web`, `bench:web`, and `size:web`, added to
`pnpm verify`.

## Complexity Tracking

No constitution violations; nothing to justify.
