---

description: "Task list for the OpenTheme command-line tool"
---

# Tasks: OpenTheme Command-Line Tool for Theme Authors

**Input**: Design documents from `specs/004-theme-author-cli/`

**Prerequisites**: plan.md, spec.md, research.md (LR1–LR10), data-model.md, contracts/cli.md,
quickstart.md

**Tests**: Included. The spec requires output equivalence with Core and the adapter (FR-T081),
100% agreement with the conformance fixtures (SC-T001), the malicious suite (SC-T005), and
documentation examples run in CI (FR-T080).

**Organization**: Tasks are grouped by user story. Paths are relative to the repository root; the
package lives in `packages/cli/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task serves (US1–US7)

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create `packages/cli/package.json` (`@opentheme/cli`, `0.1.0-draft.0`, `"type": "module"`, `license: Apache-2.0`, `bin: { "opentheme": "dist/main.js" }`, `engines.node >= 24`, dependencies `@opentheme/core` and `@opentheme/web` as `workspace:^`, devDependencies `esbuild`, `tsx`, `typescript`, scripts `build`, `test`, `bench`), `packages/cli/tsconfig.json` (extends `tsconfig.base.json`, `lib: ["ES2022"]`, `types: ["node"]`, `rootDir: src`, `outDir: dist`), and `packages/cli/vitest.config.ts`
- [X] T002 Add `packages/cli` to the root `vitest.config.ts` projects and the root `build` filter, and add the root script `bench:cli`
- [X] T003 [P] Add `tools/spec-lint/src/cli-boundaries.ts`, wired in `tools/spec-lint/src/main.ts`, so `packages/cli/src/**` imports only `@opentheme/core` (public entry and `templates`), `@opentheme/web`, relative modules, and the Node built-ins `node:util`, `node:fs`, `node:path`, `node:crypto`, `node:process`, `node:url`; never network modules, `node:child_process`, `node:vm`, `node:worker_threads`, or dynamic code (FR-T003, FR-T004)
- [X] T004 [P] Create `packages/cli/scripts/generate.ts` embedding `specification/examples/01-minimal-seed-only.opentheme.json` and the supported specification version into `packages/cli/src/generated/minimal-theme.ts`, run by `build`, with a freshness test

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T005 Implement `packages/cli/src/io.ts`: an `Io` with `stdout`/`stderr` writers, `isTerminal`, `env`, `readFile` (bytes or a typed input error), and `writeFile` (refusing an existing file unless forced); color only when `isTerminal` and neither `NO_COLOR` nor `--no-color` (LR5)
- [X] T006 Implement `packages/cli/src/format.ts`: the human diagnostic block (file, severity, code, pointer, message, hint from `@opentheme/core/templates` `formatDiagnostic`), the summary line, and `writeJson` with sorted keys and a trailing newline (LR5)
- [X] T007 Implement `packages/cli/src/args.ts`: `parseArgs` wrappers for global, input, context (data-model §2 defaults, Core schema values only), resolve, report, css, preview, and init options; invalid values and unknown options become usage errors (exit 2)
- [X] T008 Implement `packages/cli/src/admit.ts`: create one Core with `untrustedSources` set to the chosen source and `accessibilityGate` `relaxed` only with `--relaxed-gate`; admit hosts (trusted), then bases, then themes with `--trusted` or `untrusted` + source; detect hosts by `openthemeHost`; map admission status to `valid`/`invalid`/`refused` (LR2)
- [X] T009 Implement `packages/cli/src/run.ts` and `packages/cli/src/main.ts`: `run(argv, io): Promise<number>` with command dispatch, `--help` per command, `--version` (tool and specification versions), exit statuses 0/1/2/3 (LR6), and the binary entry that calls `process.exitCode = await run(...)`
- [X] T010 [P] Write `packages/cli/test/unit/{args,format,io}.test.ts`: option defaults and rejections, diagnostic formatting, JSON key order, color rules, overwrite refusal

**Checkpoint**: `opentheme --version` and `--help` run; unit tests pass

## Phase 3: User Story 1 - Check a theme (Priority: P1) 🎯 MVP

- [X] T011 [P] [US1] Write `packages/cli/test/equivalence/validate.test.ts`: for every `validate` and `validate-host` conformance fixture (reuse `packages/core/test/fixtures.ts`), write the inputs to a temporary directory, run `validate --json` (with `--base`, `--host`, and `--trusted` as the fixture's trust says), and assert the validity and the diagnostics' codes and locations equal the fixture's expected result
- [X] T012 [P] [US1] Write `packages/cli/test/commands/validate.test.ts`: several files with mixed results (exit 1), human output format, one JSON document with nothing else on stdout, missing and unreadable files (exit 3), not-JSON and oversized files reported with Core's codes
- [X] T013 [US1] Implement `packages/cli/src/commands/validate.ts` (FR-T020, FR-T021)

## Phase 4: User Story 7 - Trust from the command line only (Priority: P1)

- [ ] T014 [P] [US7] Write `packages/cli/test/trust/malicious.test.ts`: every `malicious/**` and `invalid/**` fixture through `validate`, `resolve`, `report`, `css`, and `preview` without `--trusted` completes with exit 1 or 0 (never a crash or hang), and results equal Core's untrusted handling; a document claiming an official id or provenance stays untrusted
- [ ] T015 [US7] Add the gate notice: when `--relaxed-gate` is set, every command states it in human output and includes `"gate": "relaxed"` in JSON (FR-T010 to FR-T012)

## Phase 5: User Story 2 - Resolve (Priority: P1)

- [ ] T016 [P] [US2] Write `packages/cli/test/equivalence/resolve.test.ts`: each reference theme in each of scheme × contrast × forced colors, and the `--path` subsets, equal `core.resolve` with the same inputs (JCS)
- [ ] T017 [P] [US2] Write `packages/cli/test/commands/resolve.test.ts`: defaults, every context option, invalid context values (exit 2), unknown path (exit 2), preferences file and `--set` with a preset, an invalid theme prints a fallback notice and exits 1 (FR-T033)
- [ ] T018 [US2] Implement `packages/cli/src/commands/resolve.ts` (LR4; FR-T030 to FR-T033)

## Phase 6: User Story 3 - Accessibility report (Priority: P2)

- [ ] T019 [US3] Add `accessibilityReport(themeRef, snapshot)` to `DocumentUtilities` in `packages/core/src/core.ts` (returning `{ valid, diagnostics }` from `conformanceReport` for a registered theme, operational errors for an unknown entry), update `packages/core/api/` with `pnpm api` and `specs/002-core-runtime/contracts/public-api.md`, and add `packages/core/test/api/accessibility-report.test.ts` checking the four `accessibility/` fixtures (finding L1)
- [ ] T020 [P] [US3] Write `packages/cli/test/equivalence/report.test.ts` over the `accessibility-report` fixtures, and `--strict` exit statuses
- [ ] T021 [US3] Implement `packages/cli/src/commands/report.ts` (FR-T040)

## Phase 7: User Story 4 - CSS (Priority: P2)

- [ ] T022 [P] [US4] Write `packages/cli/test/commands/css.test.ts`: output equals `toStylesheet` of `core.resolve` for each reference theme and context; `--scope`, `--element`, `--nonce`; `--out` writes the file and refuses to overwrite without `--force`
- [ ] T023 [US4] Implement `packages/cli/src/commands/css.ts` (FR-T050)

## Phase 8: User Stories 5 and 6 - Preview and init (Priority: P3)

- [ ] T024 [P] [US5] Write `packages/cli/test/commands/preview.test.ts`: one section per scheme × contrast, each section's rule equals `toStylesheet` for that mode, no `<script>`, no `http`, `src=`, or `url(` references, deterministic bytes
- [ ] T025 [US5] Implement `packages/cli/src/commands/preview.ts` (LR7; FR-T060)
- [ ] T026 [P] [US6] Write `packages/cli/test/commands/init.test.ts`: the created theme is valid, its id matches `uid.[a-z2-7]{26}`, two runs give different ids, `--name`, refusal to overwrite (exit 3), `--force`
- [ ] T027 [US6] Implement `packages/cli/src/commands/init.ts` (LR8; FR-T070)
- [ ] T028 [US6] Write `packages/cli/test/quickstart.test.ts` running quickstart.md scenario 1

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Write `packages/cli/test/binary.test.ts`: the built `dist/main.js` runs, exit statuses match, output is byte-identical across two runs, and no network or child-process module is loaded
- [ ] T030 [P] Write `packages/cli/README.md` (install, every command, options, defaults, exit statuses, examples) and `packages/cli/AGENTS.md`; add `packages/cli/test/docs/examples.test.ts` running every fenced `bash` example that starts with `opentheme` against the built binary (FR-T080)
- [ ] T031 [P] Write `packages/cli/bench/node.ts` (`bench:cli`): wall time of `validate` for the typical and the at-limit theme with start-up (SC-T003), report-only in CI
- [ ] T032 Update the root `README.md` and `AGENTS.md`, add the CI step "Benchmark (CLI)" (non-blocking), and record results in `specs/004-theme-author-cli/checklists/requirements.md`
- [ ] T033 Run `pnpm verify` and fix anything it finds

## Dependencies & Execution Order

- Setup → Foundational → US1 (MVP) → US7 → US2 → US3, US4 → US5, US6 → Polish
- US3 depends on T019 (Core API); US4 and US5 depend on US2's resolution path
- Within each story, tests first, then the command

## Implementation Strategy

1. MVP: Phases 1–3 (`validate`), then US7 before any release
2. Then resolve, report, css, preview, init, each tested on its own
3. Polish: docs, budgets, and `pnpm verify`

## Notes

- Commit after each task (the repository's per-change commit rule)
- The tool never re-implements Core behavior; gaps are findings (L1)
