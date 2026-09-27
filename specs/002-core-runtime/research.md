# Research: OpenTheme Core Runtime

**Feature**: `002-core-runtime` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

Every Technical Context unknown is resolved below. Decisions that touch the Foundation are
recorded as **Foundation prerequisites** (P1–P4) and are delivered as separate, additive
Foundation changes. None of them changes an existing expected result.

## CR1. Language, runtime targets, and module format

- **Decision**: TypeScript 6.0 (the Foundation toolchain, research R18), compiled to ES2022, ESM
  only, `sideEffects: false`. Development and CI use Node.js 24 and 26 with pnpm 10. The
  published library targets any ES2022 JavaScript engine: server runtimes, evergreen browsers,
  and React Native's Hermes. Core source MUST NOT import `node:*` modules, DOM or Web APIs,
  `fetch`, timers, `Date`, `Math.random`, `crypto`, or storage APIs. A lint rule and the
  dependency audit (SC-C009) enforce this.
- **Rationale**: Future adapters span browser, server, and React Native (constitution V). ES2022
  without platform APIs runs on all of them. ESM-only keeps tree-shaking predictable for the size
  budget (CR16).
- **Alternatives considered**: Dual CJS/ESM (twice the build surface; every current target
  supports ESM). Rust/WASM core (async instantiation conflicts with synchronous first-paint
  resolution, FR-C070, and would split the TypeScript contributor base, R18).

## CR2. Independence from the reference checker

- **Decision**: `@opentheme/core` MUST NOT depend on, import, or copy `@opentheme/reference-checker`.
  Both read the same normative artifacts (schemas, registries, baseline theme, kernel
  definitions). CI enforces independence with an import-graph check. Agreement is proven only
  through the conformance runner and a byte-level cross-check (CR15).
- **Rationale**: Foundation SC-004 and research R18 need two genuinely independent
  implementations. FR-C005.
- **Alternatives considered**: Promoting the reference checker to Core (defeats SC-004, and R18
  calls it non-normative and unoptimized). Sharing internal modules (a shared bug would pass both
  implementations).

## CR3. Parsing untrusted JSON

- **Decision**: Core ships its own bounded I-JSON tokenizer, written from chapter 12 and research
  R14: a byte-length check before any decoding (theme 1,048,576 bytes; preferences document
  65,536 bytes, CR11), nesting depth enforced during tokenization, duplicate-member detection, no
  prototype-sensitive member handling (results are built on null-prototype objects), and
  I-JSON number and string rules. It is covered by property and fuzz tests, malicious fixtures,
  and a recorded security review (NFR-C005).
- **Rationale**: The platform `JSON.parse` accepts duplicate keys and enforces no limits during
  parsing (R14). The Foundation requires size checks before parsing and bounded effort for any
  input (FR-063).
- **Alternatives considered**: `JSON.parse` followed by checks (unbounded work and silent
  duplicate loss). A third-party streaming parser (a dependency on the security path, and none
  enforces I-JSON duplicates and depth together).

## CR4. Schema validation without runtime code generation

- **Decision**: JSON Schema validators for the theme, host-declaration, and User Preferences
  schemas are **precompiled at build time** with Ajv 8 standalone code generation (draft
  2020-12). They are emitted as plain modules into `packages/core/src/generated/`. Ajv is a build
  dependency only. Schema failures are mapped to diagnostic codes through the schemas'
  `x-opentheme-code` / `x-opentheme-rule` annotations by Core's own mapping code, which follows
  chapter 13 ordering. Generated output is checked for freshness against the schemas in CI.
- **Rationale**: Runtime Ajv compiles validators with `new Function`, which strict
  Content-Security-Policy hosts and some mobile runtimes forbid, and it adds size. Precompiled
  validators are deterministic, CSP-safe, and contain no theme-derived code. The schemas stay the
  single source of truth (constitution IV).
- **Alternatives considered**: Runtime Ajv (CSP, size). Hand-written validators (drift from the
  normative schemas). Using the Ajv library is not copying the reference checker; the mapping
  and all semantic validation are Core's own (CR2).

## CR5. Numeric kernels and hashing

- **Decision**: Core implements the binary64 kernels of chapter 05 (research R7) from their
  normative definitions, with the same "no platform math" rule the Foundation applies (AGENTS.md
  invariant 2). It is verified against the kernel golden vectors through the runner and against
  the Python kernel cross-check. Canonical integrity (research R3) uses a small, pure,
  synchronous SHA-256 implementation inside Core, verified against the canonical fixtures and
  standard SHA-256 test vectors.
- **Rationale**: Determinism across runtimes (NFR-C002) forbids platform math. WebCrypto's digest
  is asynchronous and missing in some runtimes, and resolution must stay synchronous (FR-C070,
  first paint).
- **Alternatives considered**: WebCrypto (async; unavailable on Hermes). A hashing dependency
  (unnecessary for about 150 lines of well-specified code).

## CR6. Embedding normative artifacts

- **Decision**: At build time, the registries (`semantic-baseline`, `component-catalog`,
  `context-dimensions`, `customization-points`, `transformations`, `forced-colors`, `limits`,
  `diagnostics`), the specification baseline theme, and the kernel constants are compiled into
  generated, frozen modules. Only the fields Core needs are emitted. For example, diagnostics keep
  code, severity, rule, and template ids, and English templates ship in a separate, optional
  module. A CI freshness check fails if generated modules differ from the specification files.
  Core reads no files at runtime.
- **Rationale**: FR-C001 (no file I/O), FR-C030 (the baseline is always present), and the size
  budget (CR16).
- **Alternatives considered**: Loading registries through a host loader (asynchronous startup,
  and it lets hosts substitute normative data). Bundling raw JSON (about 200 KB before
  compression).

## CR7. Resolution architecture and the performance budgets

- **Decision**:
  - **Prepared themes**: when an entry becomes selectable in a snapshot, Core prepares it once:
    the flattened inheritance chain, parsed derivations, the declaration dependency graph, and a
    topological order per overlay set, ties broken by canonical path (research R12). A prepared
    theme is keyed by the integrity and trust of every chain member, plus the host declaration's
    integrity.
  - **Resolve** runs the normative stages 1 to 7 (chapter 10) over prepared data. A change to
    context or preferences re-runs only stages 2 to 7, which is where the Foundation's 4 ms
    re-resolution budget is met.
  - **Budgets**: Core's benchmark enforces research R22 as written (NFR-C001): typical validate
    plus resolve ≤ 25 ms median, at-limit ≤ 250 ms, 10 MiB rejection ≤ 5 ms, and re-resolution
    after a context or preference change ≤ 4 ms, on the CI x86-64 runner. Browser benchmarks reuse
    the `bench:browser` harness.
- **Finding (F12)**: `tools/bench` currently checks the reference checker against relaxed
  proxies (40 ms typical, 25 ms re-resolve), with a comment deferring the 4 ms target "until
  differential resolution lands". R22, the Foundation plan, and its bench task in `tasks.md` state 25 ms and 4 ms. Core
  adopts the R22 numbers. The reference-checker bench is not changed by this feature.
- **Rationale**: One declaration graph evaluated once is the Foundation's own structure (R12).
  Preparing it per theme removes all per-call parsing and graph building.
- **Alternatives considered**: Incremental graph updates per changed token (complex, and the
  budget is met without it). Caching whole results only (misses the 4 ms target on every real
  context change).

## CR8. Internal memoization

- **Decision**: Two internal, bounded LRU caches: prepared themes (CR7) and whole resolution
  results. The result key is the ordered list of `(integrity, trust)` for every entry that
  selection or inheritance can reach, the host declaration's integrity, the supported
  specification version, and the JCS bytes of `selection`, `previous`, `platform`,
  `environment`, `preferences`, and `policy` (FR-C071). Default capacities are 16 prepared
  themes and 32 results. Hosts may change them or set them to 0 to disable caching (FR-C072).
  Results are deeply frozen, so a cached result can be shared safely. Eviction uses access
  order, which never influences outputs.
- **Rationale**: Adapters often re-ask with identical inputs, for example on re-renders or
  duplicate platform events. Freezing makes sharing safe without copying.
- **Verification**: Equivalence tests run the full resolution suite with caches at default, 0,
  and 1 (eviction pressure) and compare bytes (SC-C003).
- **Alternatives considered**: A public cache API (rejected by FR-C073; no concrete consumer,
  constitution XIII). Weak-reference caches (non-deterministic memory behavior across runtimes).

## CR9. Registry and snapshots

- **Decision**: The registry is an append-and-remove store of entries. Entry identity is
  `(trust, id, version, integrity)`; an identical admission is idempotent. Every mutation
  produces a new immutable snapshot with a monotonically increasing sequence number (not a
  clock). Snapshots hold only entries that pass both admission gates (CR13), plus the built-in
  baseline. Selection over a snapshot applies chapter 10 and 12, including the per-document trust
  ordering fixed in the F1 errata. For unversioned selection it applies the rule in P1.
- **Rationale**: FR-C030–FR-C033, FR-C041.

## CR10. Theme Controller, subscriptions, and asynchronous loads

- **Decision**: A controller holds `{ snapshot, policy, context, preferences document, preview? }`
  and recomputes through the pure resolve (FR-C080). Subscribers receive one complete, frozen
  Resolved Theme per change whose JCS bytes differ from the last published result. Notification
  is synchronous after the new state is committed. Asynchronous source loads and store reads
  carry a generation counter, and a completion from an older generation is discarded (FB-C004).
  Preview holds a second input set: previews never call the store (constitution VI), and accept
  commits the preview inputs and writes once.
- **Rationale**: Adapters in every framework can wrap a synchronous callback subscription.
  Comparing bytes ensures that no-op changes don't notify (US3 scenario 4).
- **Alternatives considered**: An observable or reactive library (a framework-like dependency).
  Asynchronous notification (breaks first-paint guarantees).

## CR11. User Preferences document format (Foundation prerequisite P3)

- **Decision**: Delivered by this feature as a new, independently versioned contract. Details are
  in [contracts/user-preferences-document.md](./contracts/user-preferences-document.md).
  - Format member `openthemePreferences: "1.0"` (MAJOR.MINOR, versioned like themes, FR-081
    style: accept `1.0` to `1.N`, reject newer minors and other majors).
  - Members: `selection` (`{ id, version? }` or `null`), `previous` (`{ id, version }` or
    `null`), `values` (point id → literal), and optional `$extensions` (opaque, preserved).
  - **Two-level validation**. *Document-level* errors (malformed, oversized, unknown members,
    bad format version, bad selection or previous shape, invalid point ids, too many entries)
    make the document unusable as a whole. *Value-level* problems (a value that is not one of the
    permitted literal shapes) are warnings (`OT-PREF-008`): that entry is ignored when compiling
    to the resolution input, is kept in storage unchanged, and every other entry still applies.
    Type and constraint problems relative to a theme's point stay resolution findings
    (`OT-CUS-101`/`102`, FR-044).
  - Limits: 65,536 bytes; nesting depth 8; at most 512 values; string values at most 256
    characters.
  - New diagnostics `OT-PREF-001`…`OT-PREF-009` and rules `R-PREF-001`…, a normative chapter
    `specification/spec/18-user-preferences.md`, a schema at
    `specification/schemas/user-preferences/1.0/user-preferences.schema.json`, fixtures under
    `conformance/fixtures/preferences/`, and a new runner kind `validate-preferences`.
- **Rationale**: Resolves Q1. The two-level split keeps FB-005 ("other entries still apply")
  true for stored data, and keeps a single bad value from destroying a user's personalization.
- **Alternatives considered**: Storing the raw resolution-input members (no version, no
  migration path). Rejecting the whole document for one bad value (violates FB-005 in spirit).
  Nesting values per theme (the Foundation keys preferences by point id so they carry over,
  chapter 9).

## CR12. Operational error vocabulary

- **Decision**: A closed set of kebab-case kinds without the `OT-` prefix, versioned with Core's
  API. See [contracts/operational-errors.md](./contracts/operational-errors.md). Operational
  errors are returned in result objects for data-dependent refusals, for example admission
  refusals and store failures. Core throws only for programming errors against the typed API,
  such as a wrong argument type or a disposed controller. Thrown errors also carry an
  operational error payload.
- **Rationale**: Resolves Q3 (clarification 3).

## CR13. Host settings and admission gates

- **Decision**: `CoreSettings` (all optional, secure defaults):
  - `untrustedSources: { "user-created", "imported", "shared", "ai-generated" }`, each `false` by
    default (FR-C024);
  - `accessibilityGate: "enforce" | "relaxed"`, default `"enforce"` (FR-C028);
  - `registryCapacity`, default 256 entries (FR-C074);
  - `cache: { preparedThemes: 16, results: 32 }` (CR8).
  Admission order: trust and source category present, then source allowed (cheap refusals
  first, no parsing), size, parse, schema and semantic validation, then, for untrusted valid
  themes, the accessibility gate. The gate uses the Foundation's validation-time accessibility
  report (FR-064, chapter 11: every declared pair in every mode, where a mode is a color scheme
  and contrast combination) and refuses when any `OT-A11Y-003` is present. Gates are
  re-evaluated for affected entries when the host declaration or a base changes (FR-C027,
  FR-C028).
- **Rationale**: Resolves Q2 and Q5 without touching the resolution contract.

## CR14. Policy presets

- **Decision**: Two presets, as frozen data that compiles to the abstract policy (FR-C065):
  - `closed` (default): `availableThemes` = trusted registered themes;
    `defaultTheme` = the host-provided default; `permittedPoints` = none;
    `allowedColorSchemes` = light and dark; `accessibilityFloor: "wcag22-aa"`.
  - `common-personalization`: the same, plus `permittedPoints` = the seven standard points with
    registry constraints (no narrowing).
  Hosts that need more write the abstract policy directly.
- **Rationale**: Constitution III ("a single documented setting") and XI (quickstart).

## CR15. Verification strategy and tooling

- **Decision**:
  - **Harness**: `packages/core-conformance` (private) exposes `ot-core serve-conformance`
    speaking NDJSON protocol 1, supporting every kind of the resolver class plus
    `validate-preferences`. It is run with `pnpm conformance:core` (the runner with
    `--impl`).
  - **Sweeps through the protocol (Foundation prerequisite P2)**: the runner's sweeps currently
    call the reference checker in-process. They are changed, additively, to send generated
    requests through the protocol to whichever `--impl` is used.
  - **Cross-check**: `pnpm crosscheck:core` sends every fixture and sweep case to both
    implementations and compares JCS bytes (SC-C002).
  - **Core-only tests**: Vitest and fast-check in `packages/core/test/` (unit, property,
    malicious, determinism, cache equivalence, controller, store fakes, gates, and version
    handling).
  - **Two runtimes**: the determinism suite runs in Node and in a headless browser build that
    reuses the `bench:browser` harness (SC-C003).
  - `pnpm verify` gains `conformance:core`, `crosscheck:core`, `test` (which includes Core), and
    `bench:core`.
- **Rationale**: Reuse the Foundation's suite unchanged as the authority (spec, Testing and
  Conformance Strategy).

## CR16. Size budget

- **Decision**: `@opentheme/core` (full public API, minified and gzip-compressed with its
  embedded artifacts, excluding optional English message templates) ≤ 100 KB, enforced in CI by
  bundling the package entry. The budget is re-baselined only by a plan amendment. Measured
  inputs today: registries needed at runtime come to about 12 KB gzip-compressed and the
  baseline theme about 0.5 KB; the rest is code and precompiled validators.
- **Rationale**: Constitution "Dependencies and budgets" requires a CI-enforced size budget, and
  R22 assigns it to this feature. 100 KB is a ceiling that leaves room for the precompiled
  validators while staying below typical framework runtimes.
- **Alternatives considered**: No budget until measured (violates the constitution gate). A
  tight 50 KB budget (the precompiled validators' size is not yet measured; risks a false
  failure).

## CR17. Packaging and versioning (resolves Q7)

- **Decision**: New workspace glob `packages/*`.
  - `packages/core` → `@opentheme/core`, published. It contains the API, the embedded artifacts,
    presets, and the in-memory store (all small and needed by the quickstart).
  - `packages/core-conformance` → private harness.
  - Core versions stay `0.x` pre-releases until the specification is `1.0.0` final (FR-C103).
    Supported versions are declared in code and docs: `spec: ["1.0"]` and
    `preferences: ["1.0"]`.
  - Public types come from the same schemas through the existing `tools/types` generator, with a
    second output into `packages/core/src/generated/types/` (constitution XI; FR-C104).
- **Rationale**: Constitution V (independently versioned packages) and the minimum number of
  packages with a concrete consumer (XIII).

## Foundation prerequisites (delivered as separate, additive Foundation changes)

| Id | Change | Why | Blocks |
|---|---|---|---|
| **P1** | Chapter 10 errata: an unversioned selection picks the highest SemVer precedence among selectable versions; if it is invalid, FB-001 applies. Adds a fixture and the reference-checker `pickEntry` fix (it currently takes the last inserted) | Clarification 4; F5; NFR-001 | Core selection |
| **P2** | Runner: sweeps and host coverage go through the protocol to `--impl` (additive; default behavior unchanged) | SC-C001, SC-C002; F11 | Core sweeps |
| **P3** | User Preferences contract: chapter 18, schema, `OT-PREF-*` codes, `R-PREF-*` rules, fixtures, runner kind `validate-preferences`, reference-checker support, types, CHANGELOG | Clarifications 1 and 3; FR-C067–FR-C069 | Core persistence |
| **P4** | AGENTS.md and `llms.txt` updates: the repository now ships a runtime; add the `PREF` rule area; add Core commands | Constitution XI; AGENTS.md accuracy | Release |

Each prerequisite follows the constitution's contract-change rule (schema, prose, fixtures,
version or changelog entry) and runs `pnpm verify` green before Core work that depends on it.

## Measured results (2026-09-26, T119)

`pnpm bench:core` on the development machine (WSL2, x86-64), through the public API:

| Budget (R22) | Measured median |
|---|---|
| Typical admit + resolve ≤ 25 ms | 12.4 ms |
| At-limit admit + resolve ≤ 250 ms | 223–229 ms, bundled build (enforced in `pnpm verify`) |
| Reject 10 MiB ≤ 5 ms | 0.02 ms |
| Re-resolve after a context change ≤ 4 ms | 1.0 ms |

`pnpm size:core`: 76,558 B gzip (budget 102,400 B). The at-limit theme (10,000 tokens, 3,500
`color.mix` derivations, 64 overlays, just under 1 MiB) is still over budget; cost is spread over
parsing, integrity, schema, token-graph checks, and the four validation modes. `bench:core` is not
yet in `pnpm verify` for that reason.

Desktop Chrome (the same code, bundled, via `pnpm bench:core:browser`): typical 13.0 ms,
at-limit 384 ms, 10 MiB refusal 0.0 ms, re-resolution 1.1 ms; determinism hashes equal Node's
for all 119 resolution fixtures. Reusing evaluations across validation modes was measured and
brought no gain (the high-contrast modes evaluate only ~3,100 declarations); it was not kept.

Update (T121): a structurally shared canonical form written by the engine's serializer, a
single-pass UTF-8 encoder, string-path token walks, and skipping the lone-surrogate pass when a
string has no surrogates bring the at-limit case to 223–229 ms (Node, bundled), so `bench:core` is
now part of `pnpm verify`. Desktop Chrome on the same machine is uniformly about 1.5× slower in
every phase (`?phases` on the browser page: parse 35 ms, integrity 56 ms, validation 262 ms,
resolution 214 ms, against 23, 38, 177, and 141 ms in Node), which points to the environment rather
than to a browser-specific cost; the browser budget is the reference phone's (1 s, T125).
