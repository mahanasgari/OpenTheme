---

description: "Task list for design tokens interchange"
---

# Tasks: Design Tokens Interchange

**Input**: `specs/005-design-tokens-interchange/` (plan.md, spec.md, research.md IR1–IR7,
contracts/api.md, quickstart.md)

**Tests**: Included (SC-D001 to SC-D006 require equivalence, round trip, corpus, and hostile-input
tests).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Create `packages/dtcg` (`package.json` for `@opentheme/dtcg` with `@opentheme/core` as its only dependency, `tsconfig.json`, `vitest.config.ts`) and wire it into the root build filter and Vitest projects
- [X] T002 [P] Create `packages/dtcg/scripts/generate.ts` writing `src/generated/data.ts` (baseline path → type from `semantic-baseline.json`, and the seed-only example's `seeds`), run by `build`, with a freshness test
- [X] T003 [P] Extend `tools/spec-lint/src/web-boundaries.ts` (or a new `dtcg-boundaries.ts` wired in `main.ts`) so `packages/dtcg/src/**` imports only `@opentheme/core` and relative modules and uses no network API or dynamic code; allow `@opentheme/dtcg` in `cli-boundaries.ts`

## Phase 2: Foundational

- [X] T004 Implement `packages/dtcg/src/report.ts` (`ReportEntry`, a collector that sorts by path then action) and `packages/dtcg/src/values.ts` (resolved → DTCG encoders and DTCG → OpenTheme decoders per IR3 and IR5, each returning a value or a reason)
- [X] T005 [P] Write `packages/dtcg/test/values.test.ts`: every row of IR3 both ways, font weight keywords, `s` to `ms` exactness, and each unsupported variant's reason

## Phase 3: User Story 1 - Export (Priority: P1)

- [X] T006 [P] [US1] Write `packages/dtcg/test/export.test.ts`: for Aurora and Graphite in every supported scheme at standard and high contrast, every exported token's value equals Core's resolved value (decoded back), every token has `$type`, derived tokens carry the declared `$derive` under `$extensions["org.opentheme"].derive`, a typography token with a dimension line height and density values are reported, and an invalid entry is refused
- [X] T007 [US1] Implement `packages/dtcg/src/export.ts` `exportTheme` (IR2 to IR4) and export it from `src/index.ts`

## Phase 4: User Story 2 - Import (Priority: P1)

- [X] T008 [P] [US2] Write `packages/dtcg/test/import.test.ts`: group `$type` inheritance, aliases rewritten under `primitive`, name conversion and collisions, every unsupported construct reported and absent from the theme, cascading left-out aliases, alias cycles, seeds and roles from a mapping, default seeds reported, a mapping naming a missing or wrongly typed token, `--restore-derivations`, and a theme Core rejects is not returned
- [X] T009 [P] [US2] Write `packages/dtcg/test/hostile.test.ts`: not JSON, not an object, over 1 MiB, nesting deeper than the limit, huge alias chains, `__proto__` and `constructor` names; no crash, no hang
- [X] T010 [US2] Implement `packages/dtcg/src/names.ts` and `packages/dtcg/src/import.ts` `importTokens` (IR5, IR6) and export it from `src/index.ts`
- [X] T011 [US2] Write `packages/dtcg/test/roundtrip.test.ts`: export each reference theme, import each document with a mapping of every exported baseline role and the scheme's seeds, and check the imported theme is valid and each mapped role resolves to the original value (SC-D002)

## Phase 5: User Story 3 - Commands and docs (Priority: P2)

- [X] T012 [US3] Implement `packages/cli/src/commands/export.ts` and `import.ts` (contracts/api.md), register them, and add `@opentheme/dtcg` to the command-line tool's dependencies
- [X] T013 [P] [US3] Write `packages/cli/test/commands/interchange.test.ts`: the commands write the same documents as the library, file naming, `--mode`, overwrite refusal, `--json`, exit statuses
- [X] T014 [P] [US3] Write `packages/dtcg/README.md` and add export and import to `packages/cli/README.md`; the command-line docs test runs the new examples
- [X] T015 Record findings D1 to D3 in `specification/CHANGELOG.md` under "Unreleased" and in the root `README.md` and `AGENTS.md` package lists
- [X] T016 Run `pnpm verify`, time export and import of the typical theme (SC-D005), and record results in `checklists/requirements.md`

## Dependencies

Setup → Foundational → US1 → US2 (round trip needs export) → US3 → polish. Commit after each task.
