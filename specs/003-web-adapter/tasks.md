---

description: "Task list for the OpenTheme Web adapter"
---

# Tasks: OpenTheme Web Adapter

**Input**: Design documents from `specs/003-web-adapter/`

**Prerequisites**: plan.md, spec.md, research.md (WR1–WR10), data-model.md, contracts/
(css-output.md, public-api.md), quickstart.md

**Tests**: Included. The spec requires the quickstart as a CI test (SC-W008), output-target
conformance (FR-W050), and a malicious-input suite (SC-W002).

**Organization**: Tasks are grouped by user story. Paths are relative to the repository root; the
package lives in `packages/web/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task serves (US1–US5)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the package and wire it into the workspace and gates

- [X] T001 Create `packages/web/package.json` (`@opentheme/web`, version `0.1.0-draft.0`, `"type": "module"`, `license: Apache-2.0`, `sideEffects: false`, exports `.` → `dist/index.js`/`dist/index.d.ts`, `peerDependencies: { "@opentheme/core": "workspace:^" }`, devDependencies `happy-dom`, `esbuild`, `typescript`, and scripts `build`, `test`, `size`, `bench`), `packages/web/tsconfig.json` (extends `tsconfig.base.json`, `lib: ["ES2022", "DOM"]`, `rootDir: src`, `outDir: dist`), and `packages/web/vitest.config.ts` (`environment: "happy-dom"`, `include: ["test/**/*.test.ts"]`)
- [X] T002 Add `packages/web` to the root `vitest.config.ts` projects, add `@opentheme/web` to the root `build` filter, and add root scripts `conformance:web`, `bench:web`, and `size:web` in `package.json` (added to `verify` and `verify:correctness` in T037)
- [X] T003 [P] Create `packages/web/src/index.ts` exporting nothing yet and `packages/web/test/helpers.ts` (repo root, `read(path)`, the Aurora, Graphite, and notes-host paths, and a light/standard/medium/`en`/`ltr` context), mirroring `packages/core/test/helpers.ts`
- [X] T004 [P] Add `tools/spec-lint/src/web-boundaries.ts`, wired in `tools/spec-lint/src/main.ts`, so `packages/web/src/**` may import only `@opentheme/core` (its public entry, never `internal-conformance`) and relative modules, never a UI framework, a Node built-in, or `tools/**`, and never uses a network API (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`), cookies, or dynamic code (FR-W023, FR-W040 to FR-W042)
- [X] T005 [P] Create `packages/web/scripts/size.ts`: bundle `dist/index.js` with esbuild (`@opentheme/core` external, minified, ESM, browser platform), gzip, and fail above 10,240 bytes (SC-W007)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The naming and serialization contract every story builds on (contracts/css-output.md)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Write `packages/web/test/unit/naming.test.ts`: every row of the naming table in contracts/css-output.md, injectivity over all standard catalog paths plus paths with hyphens in segments (`a.b-c` versus `a-b.c`), and rejection of any segment not matching `[a-z][a-z0-9-]*`
- [X] T007 [P] Write `packages/web/test/unit/serialize.test.ts`: every row of the values table in contracts/css-output.md, including `rgb(r g b)` when alpha is 1, `rgb(r g b / a)` otherwise, all nine system colors from `forced-colors.json` `cssSystemColorHint`, generic families unquoted, other family names quoted with `\` and `"` escaped, shortest round-trip numbers (including exponents), and `null` for any unsupported shape
- [X] T008 Implement `packages/web/src/naming.ts` (WR2): `tokenName(path)`, `componentName(contract, part, property, state, variant?)`, and `memberSuffix(member)`; segments must match `[a-z][a-z0-9-]*` (host identifiers: dot-separated segments), `.` becomes `_`, `/` becomes `__`, composite members become `___<kebab-case>`, variants insert `_v_<axis>_<value>`, tokens use `--ot-` and components `--otc-`; return `null` for a name outside the grammar
- [X] T009 Implement `packages/web/src/serialize.ts` (WR3): one serializer per resolved shape returning CSS text or `null` for a shape with no serializer; system color names come from `specification/registry/1.0/forced-colors.json` embedded at build time (generate `packages/web/src/generated/system-colors.ts` in the build script); the generic family list is generated in the same file from `specification/schemas/1.0/defs/tokens.schema.json` `$defs.genericFamily`
- [X] T010 Write the test-only decoder `packages/web/test/decode.ts`: the exact inverse of T008 and T009, turning declarations back into Core's `tokens` and `components` shapes

**Checkpoint**: Naming and serialization are complete, tested, and reversible

---

## Phase 3: User Story 1 - Style a web page from a resolved theme (Priority: P1) 🎯 MVP

**Goal**: A Resolved Theme becomes custom properties applied to the document or an element scope,
updated by diff, and removed cleanly

**Independent Test**: Resolve each reference theme in each mode, apply it, read every property
back, and decode it; every value equals Core's resolved value

### Tests for User Story 1

- [X] T011 [P] [US1] Write `packages/web/test/conformance/output-target.test.ts` (FR-W050): for every `conformance/fixtures/resolution/**` fixture (reuse Core's fixture expansion approach from `packages/core/test/fixtures.ts`), resolve through Core, run `toDeclarations`, decode with `test/decode.ts`, and assert JCS equality with Core's `tokens` and `components`; omissions must be empty for fixtures without host-specific names outside the grammar
- [X] T012 [P] [US1] Write `packages/web/test/quickstart.test.ts` running quickstart.md scenario 1 verbatim
- [X] T013 [P] [US1] Write `packages/web/test/dom/scope.test.ts`: document scope writes to a `:root` rule; two element scopes see only their own values; an update sets and removes only changed properties (count the calls); `detach()` removes the rule, the style element, the `data-opentheme-scope` attribute, and is idempotent; attaching twice to one target throws an `OpenThemeWebError` of kind `scope-conflict`; an invalid scope id throws one of kind `invalid-argument`

### Implementation for User Story 1

- [X] T014 [US1] Implement `packages/web/src/declarations.ts`: `toDeclarations(resolved)` walking `resolved.tokens` (including host-qualified tokens and composite members) and `resolved.components` (states and `$variants`), producing declarations sorted by name in UTF-16 code-unit order plus omissions `{ path, reason: "name-grammar" | "value-shape" }` (WR10)
- [X] T015 [P] [US1] Implement `packages/web/src/stylesheet.ts`: `toStylesheet(resolved, { scope?, nonce?, element? })` producing `:root { … }` or `[data-opentheme-scope="<id>"] { … }`, and with `element: true` the full `<style data-opentheme-scope="<id>">` element with the optional nonce attribute
- [X] T016 [US1] Implement `packages/web/src/errors.ts` (`OpenThemeWebError` with `kind`, `operation`, `message`) and `packages/web/src/scope.ts` `attachTheme` (WR4): validate the scope id (`[a-z][a-z0-9-]*`), refuse a managed target (`scope-conflict`), create an empty `<style data-opentheme-scope>` element (or adopt an existing one), add one rule through the CSS object model, create the Core controller with the policy, context, store, and initial preferences, apply every controller publication by diff (`setProperty`/`removeProperty` only for changed names), keep the `AdapterReport`, and implement idempotent `detach()` that also disposes the controller and every listener
- [X] T017 [US1] Export `toDeclarations`, `toStylesheet`, `attachTheme`, and the `WebScope`/`AdapterReport` types from `packages/web/src/index.ts` as listed in contracts/public-api.md

**Checkpoint**: User Story 1 is functional and conformance passes on every resolution fixture

---

## Phase 4: User Story 5 - Unsafe values never reach the page (Priority: P1)

**Goal**: Whatever an untrusted theme contains, only serialized typed values are written

**Independent Test**: Apply every malicious and invalid fixture Core admits and resolves; every
written value matches the grammar and the stylesheet keeps exactly one rule

### Tests for User Story 5

- [X] T018 [P] [US5] Write `packages/web/test/malicious/output.test.ts`: admit every `conformance/fixtures/malicious/**` and `invalid/**` theme as untrusted with sources enabled, resolve what Core accepts, apply it, and assert every value matches the contract's value grammar (a single regular expression per type), no value contains `;`, `{`, `}`, `<`, or an unescaped `"`, and the scope's stylesheet has exactly one rule
- [X] T019 [P] [US5] Write `packages/web/test/unit/omissions.test.ts`: a host declaration with a contract, part, property, or variant name outside `[a-z][a-z0-9-]*` (for example `My Part`, `a_b`, `x}y`) and a `gradient` property produce omissions with the right reason and write nothing for them (findings W1, W2)

### Implementation for User Story 5

- [X] T020 [US5] Harden `packages/web/src/serialize.ts` and `packages/web/src/naming.ts` so every value is built only from typed numbers, keywords, and escaped strings, and every name only from grammar-checked segments; add a final assertion in `packages/web/src/declarations.ts` that drops (and reports) any declaration failing the grammar
- [X] T021 [US5] Record the security review for `packages/web/src/**` in `specs/003-web-adapter/checklists/security-review.md` (names, values, CSSOM writes, server-rendered element, storage)

**Checkpoint**: The adapter is safe against every malicious fixture

---

## Phase 5: User Story 2 - Follow the user's system settings live (Priority: P1)

**Goal**: Media features and document attributes feed Core's context, live and without duplicates

**Independent Test**: Simulate each preference change; exactly one re-resolution per real change,
none for repeats

### Tests for User Story 2

- [X] T022 [P] [US2] Write `packages/web/test/dom/context.test.ts`: with a controllable `matchMedia` stub, each of `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, and `prefers-reduced-motion` maps as in data-model.md §4 (missing features → `no-preference`, `standard`, `false`, `false`); a change causes exactly one `setContext`; a repeated identical signal causes none; `lang` and `dir` changes on the document or scope element update `locale` and `direction`; `setSizeClass` and `setTextScale` update the context; forced colors write system colors; the user's explicit color-scheme choice (the `color-scheme` point) stays applied when the system setting changes; without a `lang` attribute the `locale` option (default `en`) is used
- [X] T023 [P] [US2] Write `packages/web/test/unit/helpers.test.ts`: `sizeClassForWidth` returns `compact` below 600, `medium` from 600, `expanded` from 1024; `textScaleFromRoot` returns root font size / 16 and 1 when unavailable

### Implementation for User Story 2

- [X] T024 [US2] Implement `packages/web/src/context.ts` (WR5): read the four media features through `matchMedia` with change listeners, observe `lang`/`dir` on the document element and the scope element with one `MutationObserver`, merge host inputs (`sizeClass`, `textScale`, default `locale`), keep the last context sent, and call the controller's `setContext` only on a real change; export `sizeClassForWidth` and `textScaleFromRoot`
- [X] T025 [US2] Wire the context source into `packages/web/src/scope.ts` (initial context for the controller, `setSizeClass`, `setTextScale`, listener removal in `detach()`), and export the helpers from `packages/web/src/index.ts`

**Checkpoint**: Live context works and is covered by tests

---

## Phase 6: User Story 3 - Remember personalization on the device (Priority: P2)

**Goal**: Preferences persist per scope in browser storage, with safe failure

**Independent Test**: Make choices, re-attach, and see them used by the first resolution; with
failing storage, everything still applies and a store failure is reported

### Tests for User Story 3

- [X] T026 [P] [US3] Write `packages/web/test/dom/store.test.ts`: `read`/`write`/`clear` use key `opentheme:<scope>` (custom prefix supported); two scopes do not overwrite each other; a throwing storage rejects (and the controller lists `store-read-failed`/`store-write-failed`); a throwing `readInitial` makes `attachTheme` still apply and list `store-read-failed` in the scope's `errors`; a re-attached scope's first resolution uses the stored selection; corrupt, oversized, or newer-format stored data is ignored and left untouched

### Implementation for User Story 3

- [X] T027 [US3] Implement `packages/web/src/store.ts` `createBrowserStore({ storage?, prefix? })` (WR6): Core `PreferenceStore` over `localStorage` or the supplied storage, every access wrapped so exceptions reject, plus synchronous `readInitial(scope)` that returns the stored bytes or `null` and throws on a storage failure
- [X] T028 [US3] In `packages/web/src/scope.ts`, default `store` to `createBrowserStore()` (`false` disables it) and default `initial` to `store.readInitial(scope)`, recording `store-read-failed` in the scope's `errors` when it throws; export `createBrowserStore` from `packages/web/src/index.ts`

**Checkpoint**: Preferences persist and failures are safe

---

## Phase 7: User Story 4 - No flash of the wrong theme (Priority: P2)

**Goal**: Server-rendered output equals the client's first application, with no rewrite

**Independent Test**: Render the initial element, attach the client with the same inputs, and
count zero property writes

### Tests for User Story 4

- [ ] T029 [P] [US4] Write `packages/web/test/dom/first-paint.test.ts`: `toStylesheet(resolved, { element: true, scope })` inserted into the page, then `attachTheme` with the same inputs adopts the element and performs zero `setProperty`/`removeProperty` calls; with different inputs it updates only the differing properties; the nonce is preserved on the adopted element

### Implementation for User Story 4

- [ ] T030 [US4] Implement adoption in `packages/web/src/scope.ts`: find `<style data-opentheme-scope="<id>">`, read its rule's current declarations as the baseline, and diff against the first resolution instead of rewriting; `detach()` removes an adopted element too

**Checkpoint**: All user stories are independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, budgets, findings, and the full gate

- [ ] T031 [P] Write `packages/web/README.md` (quickstart, naming examples, forced colors, scopes, server rendering, persistence, CSP and nonce) and `packages/web/AGENTS.md` (integration pattern, what the adapter never does, common mistakes)
- [ ] T032 [P] Add `packages/web/test/docs/examples.test.ts` running every fenced `ts` block in the README and agent guide (same approach as `packages/core/test/docs/examples.test.ts`)
- [ ] T033 [P] Write `packages/web/bench/node.ts` (`bench:web`): declaration generation plus diff for the typical theme, and a context-change update including Core re-resolution, each ≤ 4 ms median (SC-W006), failing above budget
- [ ] T034 [P] Extend the browser page (`packages/core/bench/browser.ts` or a new `packages/web/bench/browser.ts`) to time `attachTheme` apply and a context-change update in a real browser
- [ ] T035 [P] Record findings W1 and W2 in `specification/CHANGELOG.md` under an "Unreleased" open-findings note and in `specs/003-web-adapter/plan.md`, without changing Foundation behavior
- [ ] T036 Update the root `AGENTS.md` (layout row for `packages/web`, the web gates, and that the repository now ships the Web adapter) and the root `README.md` "What is here" table
- [ ] T037 Add `conformance:web`, `size:web`, and `bench:web` to `pnpm verify`, and `conformance:web` and `size:web` to `pnpm verify:correctness` in the root `package.json`; add a non-blocking "Benchmark (Web)" step to `.github/workflows/ci.yml` beside the Core one (constitution VIII)
- [ ] T038 Run `pnpm verify` and record the results (conformance counts, test counts, size, and bench medians) in `specs/003-web-adapter/checklists/requirements.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational; it is the MVP and the base the other stories extend
  (`scope.ts`)
- **US5 (Phase 4)**: Depends on Foundational and T014 (declarations)
- **US2 (Phase 5)**, **US3 (Phase 6)**, **US4 (Phase 7)**: Depend on US1's `scope.ts` (T016);
  independent of each other
- **Polish (Phase 8)**: Depends on the stories being complete

### Within Each User Story

- Tests first, then implementation; `scope.ts` changes in US2, US3, and US4 are sequential because
  they touch the same file

### Parallel Opportunities

- T003, T004, and T005 in Setup; T006 and T007 in Foundational
- Each story's test tasks ([P]) together
- US2 tests with US3 tests with US4 tests, once US1 is done
- T031 to T035 in Polish

---

## Parallel Example: User Story 1

```text
Task: "Write output-target conformance in packages/web/test/conformance/output-target.test.ts"
Task: "Write the quickstart test in packages/web/test/quickstart.test.ts"
Task: "Write scope DOM tests in packages/web/test/dom/scope.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup, then Phase 2 naming and serialization
2. Phase 3: `toDeclarations`, `toStylesheet`, `attachTheme`, conformance
3. **Stop and validate**: conformance on every resolution fixture and the quickstart test

### Incremental Delivery

1. MVP (US1), then US5 (safety) before any public release
2. US2 (live context), US3 (persistence), US4 (first paint), each tested on its own
3. Polish: docs, budgets, findings, and `pnpm verify` with the web gates

---

## Notes

- Commit after each task (the repository's per-change commit rule)
- The adapter never re-implements Core logic; gaps are findings (FR-W041, FR-W043)
