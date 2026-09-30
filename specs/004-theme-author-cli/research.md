# Research: OpenTheme Command-Line Tool for Theme Authors

**Feature**: `004-theme-author-cli` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Each decision records what was chosen, why, and what else was considered. The spec had no open
clarifications; these decisions settle the technical questions it left to the plan.

## LR1. Package, runtime, and dependencies

- **Decision**: A new workspace package `packages/cli` (`@opentheme/cli`, TypeScript, ES2022, ESM),
  with a `bin` entry `opentheme` → `dist/main.js`. Runtime dependencies: `@opentheme/core` and
  `@opentheme/web` only. Command-line parsing uses Node's built-in `node:util` `parseArgs`;
  randomness for `init` uses `node:crypto`. Node.js 24 or later.
- **Rationale**: Constitution V (thin, independently versioned tools over Core) and the spec's
  dependency rule. `parseArgs` covers flags, repeated options, and positionals without a
  dependency.
- **Alternatives considered**: A command-line framework (commander, yargs; rejected: runtime
  dependencies for little gain); extending the private reference checker's CLI (rejected: it is a
  non-normative verification tool, and the author tool must give Core's answers).

## LR2. Validation through the public API (FR-T020, FR-T021)

- **Decision**: One Core instance per run. Host declarations are admitted first (trusted, developer
  input), then base themes, then the themes to validate, each with the trust and source given on
  the command line. A theme's result is the admission result: `registered` or
  `already-registered` is valid; `invalid` carries the validation diagnostics; `refused` carries
  an operational error (for example `accessibility-gate` or `source-not-allowed`). Core validates
  each admission against the host and the themes already admitted, which is how inheritance and
  host-aware validation work (FR-C013). A file whose `openthemeHost` member is present is a host.
- **Rationale**: Uses only the public API; admission is exactly what an application does, so the
  tool cannot disagree with applications.
- **Alternatives considered**: `@opentheme/core/internal-conformance` (rejected: internal, not a
  supported API).

## LR3. Accessibility report (FR-T040) — finding L1

- **Decision**: Core's public API does not expose the chapter 11 accessibility conformance report;
  only `@opentheme/core/internal-conformance` does. This feature adds one additive public method,
  `core.documents.accessibilityReport(themeRef, snapshot)`, returning
  `{ valid, diagnostics }` from the same function the conformance harness uses, plus its API report
  entry and a test. The tool calls it for a registered theme.
- **Rationale**: FR-064 requires the report to be available to hosts; the tool must not use
  internal exports. The method adds no behavior (it exposes an existing, conformance-tested
  function), so Core's minor version changes and nothing else does.
- **Alternatives considered**: Deriving the report from `resolve` in each mode (rejected: the
  resolved `accessibility` member reflects a resolution with a policy and runtime floors, not the
  chapter 11 report's definition, so the answers could differ).

## LR4. Resolution defaults (FR-T030 to FR-T033)

- **Decision**: The default context is light, standard contrast, no forced colors, standard
  motion, text scale 1, `medium`, `en`, `ltr`. The default policy is the abstract policy
  `{ availableThemes: [<theme id>], defaultTheme: <theme id> }` with no permitted points; the
  `--preset` option selects Core's `closed` or `common-personalization` preset instead, and
  preferences require a preset that permits their points. The selection is the theme's id and
  version. When the applied theme is not the selected one (`applied.fallback` is not `none`), the
  tool prints a notice first and exits with the "check failed" status.
- **Rationale**: Authors want to see their own theme; a silent fallback would hide their errors
  (FR-T033).

## LR5. Output formats and determinism (FR-T002, FR-T006)

- **Decision**: Human output is plain text with optional ANSI color only when standard output is a
  terminal and neither `NO_COLOR` nor `--no-color` is set. `--json` prints exactly one JSON
  document, serialized with sorted keys (JCS-compatible) and a trailing newline. Diagnostics keep
  Core's order. Messages and hints come from `@opentheme/core/templates` `formatDiagnostic`.
  Nothing time- or environment-dependent is printed, except `init`'s new identifier.
- **Rationale**: Byte-identical output for pipelines and golden tests.

## LR6. Exit statuses (FR-T005)

- **Decision**: `0` success; `1` a document is invalid, refused, fell back, or a strict report has
  shortfalls; `2` usage error (unknown command or option, invalid option value, unknown path);
  `3` input or output failure (missing or unreadable file, write failure, refusal to overwrite).
- **Rationale**: Distinguishes author mistakes from tool misuse and environment problems.

## LR7. CSS and preview (FR-T050, FR-T060)

- **Decision**: `css` calls `toStylesheet` from `@opentheme/web` on the resolved theme, with
  `--scope`, `--element`, and `--nonce` passed through; for the document scope with `--element`
  the scope name defaults to `opentheme`. `preview` resolves each supported color scheme at
  standard and high contrast, renders each mode's rule with `toStylesheet(resolved, { scope:
  "<scheme>-<contrast>" })`, and places sample standard components (button, card, text input,
  tabs) styled only with `--ot-` and `--otc-` properties in one section per mode. The page embeds
  everything, loads nothing, and contains no script.
- **Rationale**: Identical CSS to the adapter (SC-T006); a page without script and external
  resources is safe to open and deterministic.

## LR8. `init` (FR-T070)

- **Decision**: Start from `specification/examples/01-minimal-seed-only.opentheme.json` (embedded
  at build time), replace `id` with `uid.` + 26 lowercase base32 characters (`a-z2-7`) encoding
  128 bits from `crypto.randomBytes(16)`, set `name` from `--name` (default `"My Theme"`),
  `version` `1.0.0`, and write with two-space indentation and a trailing newline. An existing
  target is refused unless `--force`. The result is validated before it is written.
- **Rationale**: Chapter 02 defines `uid.` identifiers exactly this way.

## LR9. Testing

- **Decision**: The CLI exposes `run(argv, io)` returning an exit status and writing to injected
  streams, so tests run in process; a small set of tests spawns the built `dist/main.js` to check
  the binary, exit statuses, and that no network module is loaded. Output-equivalence tests
  compare against direct Core and Web adapter calls over the conformance fixtures (FR-T081). A
  boundary lint forbids network modules, `child_process`, `vm`, and dynamic code in
  `packages/cli/src`.
- **Rationale**: Fast, deterministic tests with a thin real-binary layer.

## LR10. Performance (SC-T003)

- **Decision**: Budgets: `validate` of the typical theme ≤ 1 s wall time including Node start-up,
  and of an at-limit theme ≤ 3 s, measured by `bench:cli` (report-only in CI, like the other
  benchmarks, because CI runners vary).
- **Rationale**: Matches the spec; start-up dominates for typical themes.
