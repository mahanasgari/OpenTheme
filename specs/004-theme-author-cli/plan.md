# Implementation Plan: OpenTheme Command-Line Tool for Theme Authors

**Branch**: `004-theme-author-cli` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-theme-author-cli/spec.md`

## Summary

Build `@opentheme/cli`, the `opentheme` command, as a thin layer over `@opentheme/core` and
`@opentheme/web`. Validation goes through registry admission (hosts, then bases, then themes, with
command-line trust); resolution through `core.resolve` with a policy that makes the author's theme
the developer default; CSS through the adapter's `toStylesheet`; the accessibility report through a
new additive public Core method that exposes the existing, conformance-tested report (finding L1).
Output is deterministic text or one JSON document, with documented exit statuses (research
LR1–LR10).

## Technical Context

**Language/Version**: TypeScript 6 targeting ES2022 (ESM), Node.js 24 or later

**Primary Dependencies**: `@opentheme/core`, `@opentheme/web` (runtime); Node built-ins
`node:util` (`parseArgs`), `node:fs`, `node:crypto`; dev: Vitest, esbuild

**Storage**: files only (inputs read, `css`/`preview`/`init` outputs written)

**Testing**: Vitest in process through `run(argv, io)`; a few spawned-binary tests; output
equivalence against Core and the adapter over conformance fixtures

**Target Platform**: Node.js 24+ on Linux, macOS, and Windows

**Project Type**: command-line tool (workspace package `packages/cli`)

**Performance Goals**: `validate` typical theme ≤ 1 s, at-limit theme ≤ 3 s, wall time including
start-up (SC-T003)

**Constraints**: no network, no child processes, no dynamic code; deterministic output; no runtime
dependency besides Core and the Web adapter

**Scale/Scope**: six commands; one theme per `resolve`/`report`/`css`/`preview`, any number for
`validate`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Pre-research | Post-design | Evidence |
|---|---|---|---|---|
| 1 | Separation (I) | Pass | Pass | Authoring tool; no application behavior |
| 2 | Personalization (II) | Pass | Pass | Preferences are passed to Core unchanged; the tool shows their effect |
| 3 | Boundaries (III) | Pass | Pass | Policy presets and points come from Core |
| 4 | Specification (IV) | Pass | Pass | No new theme capability; results equal the specification's expected results (SC-T001) |
| 5 | Thin tools (V) | Pass | Pass | Every result from Core or the adapter; the one Core change exposes an existing function (LR3) |
| 6 | Security (VI), non-negotiable | Pass | Pass | Trust only from `--trusted`; no network, child processes, or evaluation; boundary lint (LR9) |
| 7 | AI (VII), non-negotiable | Pass | Pass | No AI surface; `ai-generated` is only a source value passed to Core |
| 8 | Accessibility (VIII) | Pass | Pass | Report command; gate relaxation is explicit and stated in output; budgets benchmarked (LR10) |
| 9 | Compatibility (IX) | Pass | Pass | Command, option, output, and exit-status contract versioned with the package |
| 10 | Determinism (X) | Pass | Pass | Byte-identical output; golden tests (LR5) |
| 11 | Developer experience (XI) | Pass | Pass | README and agent guide with CI-run examples; quickstart test |
| 12 | No required cloud (XII), non-negotiable | Pass | Pass | Fully offline |
| 13 | Extensibility (XIII) | Pass | Pass | No plug-in system |

No gate for a non-negotiable principle has any exception.

## Findings

| # | Finding | Handling |
|---|---|---|
| L1 | Core's public API does not expose the chapter 11 accessibility conformance report (FR-064); only `internal-conformance` does | Add `core.documents.accessibilityReport(themeRef, snapshot)`, additive, with its API report entry and a test (LR3) |

## Delivery Phases (input to `/speckit-tasks`)

| Phase | Content | Exit criterion |
|---|---|---|
| **1: Scaffold** | `packages/cli`, bin, build, test setup, workspace wiring, boundary lint | `opentheme --version` runs |
| **2: Foundation** | argument parsing, I/O abstraction, file loading, admission with trust, diagnostic formatting, JSON writer, exit statuses | Unit tests pass |
| **3: US1 validate** | `validate` human and JSON output, bases, hosts | Equivalence over validation fixtures |
| **4: US7 trust** | trust and source options, gate relaxation notice, malicious suite | Malicious fixtures pass under every command |
| **5: US2 resolve** | context and preference options, paths, fallback notice | Equivalence over resolution fixtures |
| **6: US3 report** | Core API addition (L1), `report`, `--strict` | Equivalence over accessibility fixtures |
| **7: US4 css** | `css` with scope, element, nonce, output file | Equals `toStylesheet` for the reference themes |
| **8: US5 preview, US6 init** | preview page, `init` | Quickstart test |
| **9: Polish** | README, agent guide, docs test, `bench:cli`, root docs, `pnpm verify` | Green gate |

## Project Structure

### Documentation (this feature)

```text
specs/004-theme-author-cli/
├── spec.md
├── plan.md              # this file
├── research.md          # LR1–LR10
├── data-model.md
├── quickstart.md
├── contracts/cli.md     # commands, options, outputs, exit statuses
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/cli/
├── package.json         # @opentheme/cli; bin opentheme
├── src/
│   ├── main.ts          # process entry: run(process.argv) → exit status
│   ├── run.ts           # dispatch, global options, help, version
│   ├── io.ts            # streams, color, file reading and writing
│   ├── args.ts          # parseArgs wrappers, context and trust options
│   ├── admit.ts         # hosts, bases, themes into one Core with command-line trust
│   ├── format.ts        # human diagnostics, JSON writer
│   ├── commands/{validate,resolve,report,css,preview,init}.ts
│   └── generated/minimal-theme.ts   # embedded seed-only example for init
├── test/
├── bench/
├── README.md
└── AGENTS.md
```

**Structure Decision**: One new workspace package beside `packages/core` and `packages/web`,
following their layout and tooling. Root scripts gain `bench:cli`; the CLI tests join `pnpm test`.

## Complexity Tracking

No constitution violations; nothing to justify.
