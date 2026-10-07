---

description: "Task list for the React bindings"
---

# Tasks: React Bindings

**Input**: `specs/006-react-bindings/` (spec.md, plan.md, research.md RR1–RR8, contracts/api.md,
quickstart.md)

**Tests**: Included; SC-R001 to SC-R006 need equivalence, render-count, server-rendering, size, and
documentation tests. Write each story's tests before its implementation.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Create `packages/react/package.json` (`@opentheme/react`, `0.1.0-draft.0`, `"type": "module"`, `license: Apache-2.0`, `sideEffects: false`, exports `.` → `dist/index.js`/`dist/index.d.ts`, `peerDependencies` `react: "^18.3.0 || ^19.0.0"` and `@opentheme/core: "workspace:^"`, `dependencies` `@opentheme/web: "workspace:^"`, devDependencies `@opentheme/core: "workspace:^"`, `react`, `react-dom`, `@types/react`, `@types/react-dom` (all `^19`), `happy-dom`, `esbuild`, `tsx`, `typescript`; scripts `build` (`tsc -p tsconfig.json`), `test`, `size`), `tsconfig.json` (extends `../../tsconfig.base.json`, `lib: ["ES2022", "DOM"]`, `jsx: "react-jsx"`, `types: []`, `rootDir: src`, `outDir: dist`), and `vitest.config.ts` (`environment: "happy-dom"`, `include: ["test/**/*.test.ts?(x)"]`, `setupFiles: ["../web/test/setup.ts"]`); run `pnpm install`
- [ ] T002 Add `packages/react` to the root `vitest.config.ts` projects and the root `build` filter (after `@opentheme/web`), and add the root script `size:react`; add `pnpm run size:react` to both `verify` and `verify:correctness` in the root `package.json`
- [ ] T003 [P] Extend `tools/spec-lint/src/web-boundaries.ts` so `packages/react/src/**` is checked too, allowing imports of `react`, `@opentheme/core`, `@opentheme/web`, and relative modules only (keep the other two packages' rules unchanged); rebuild spec-lint and run `pnpm spec:check`
- [ ] T004 [P] Create `packages/react/scripts/size.ts`, copied from `packages/web/scripts/size.ts`, bundling `dist/index.js` with `react`, `react/jsx-runtime`, `@opentheme/core`, and `@opentheme/web` external, failing above 3,072 bytes gzip (SC-R005)

## Phase 2: Foundational

- [ ] T005 Implement `packages/react/src/path.ts`: `pickValue(resolved, path)` for a token path or a component path `<contract>.<part>.<property>[.<state>]` (same rule as `packages/cli/src/commands/resolve.ts` `pick`, but returning `undefined` instead of throwing), with unit tests in `packages/react/test/path.test.ts`
- [ ] T006 Implement `packages/react/src/store.ts`: a tiny external store `{ subscribe(listener), get(): Snapshot }` that holds `{ result, scope }` and is updated only from `controller.subscribe` callbacks (research RR3: never read `controller.current` in the snapshot getter except once right after attaching)

## Phase 3: User Story 1 - Theme a React app (P1)

- [ ] T007 [P] [US1] Write `packages/react/test/provider.test.tsx`: with the reference themes (Aurora and Graphite admitted as trusted), a document provider applies exactly the properties `attachTheme` applies for the same inputs (compare the `style[data-opentheme-scope]` CSSOM rule's declarations; happy-dom's computed style ignores CSSOM writes); an element target (ref) themes only that element's scope; unmount removes the style element and attribute; changing `sizeClass`/`textScale` props updates the scope without detaching (same style element); changing `scope` or `core` replaces it; a `policy` change reaches the controller; `sizeClass="auto"` follows a `resize` to 500 px (compact); using `store={false}` in every test except one that checks the default browser store writes `opentheme:<scope>`
- [ ] T008 [P] [US1] Write `packages/react/test/strict.test.tsx`: under `<React.StrictMode>` exactly one style element exists after mounting, no error is thrown, and unmount leaves none
- [ ] T009 [US1] Implement `packages/react/src/provider.tsx` `OpenThemeProvider` per research RR2, RR5, RR6 and the contract, with a React context carrying the store and `serverResolved`

## Phase 4: User Story 2 - Read and change the theme (P1)

- [ ] T010 [P] [US2] Write `packages/react/test/hooks.test.tsx`: `useOpenTheme` returns Core's resolved theme and outcome after mount; `select` of Graphite re-renders the consumer exactly once with Graphite applied (count renders with a ref counter); `setContext`-equivalent changes that leave the resolution identical (for example setting the same size class) cause zero re-renders; `useThemeValue("color.text.primary")` equals the resolved token and keeps the same reference across unrelated re-renders; an unknown path returns `undefined`; both hooks outside a provider throw the contract's message; actions before attach (server) reject
- [ ] T011 [US2] Implement `packages/react/src/hooks.ts` (`useOpenTheme`, `useThemeValue`) with `useSyncExternalStore` over the provider's store (research RR3)

## Phase 5: User Story 3 - Server rendering (P2)

- [ ] T012 [P] [US3] Write `packages/react/test/ssr.test.tsx`: `renderToString(<OpenThemeStyle resolved scope="app" root nonce="abc" />)` equals `toStylesheet(resolved, { scope: "app", root: true, element: true, nonce: "abc" })` (allowing for React's attribute order if it differs, compare the element's attributes and text); `renderToString` of a provider with `serverResolved` renders children whose `useOpenTheme().resolved` equals `serverResolved` and touches no browser API (run that test in a plain Node environment with `// @vitest-environment node`); after inserting the server HTML into the document and mounting the provider with the same inputs, the scope's rule receives zero `setProperty`/`removeProperty` calls (spy on the rule's style object as `packages/web/test/dom/first-paint.test.ts` does)
- [ ] T013 [US3] Implement `packages/react/src/style.tsx` `OpenThemeStyle` (research RR4) and export everything listed in the contract from `packages/react/src/index.ts` (nothing else)

## Phase 6: Polish

- [ ] T014 [P] Write `packages/react/README.md` (install, provider, hooks, element scopes, size class, persistence, server rendering, strict mode, errors) and `packages/react/test/quickstart.test.tsx` running `specs/006-react-bindings/quickstart.md`; add `packages/react/test/docs/examples.test.ts` that type-checks every fenced `tsx` block in the README against the built declarations (with `declare const auroraBytes: string; declare const graphiteBytes: string;`, `jsx: "react-jsx"`) and renders each block's exported `App` (if any) with `createRoot` inside `act`, failing on any thrown error; add `packages/react/test/docs/.examples/` to `.gitignore`
- [ ] T015 Update the root `README.md` "What is here" table and spec list, and `AGENTS.md`'s `packages/` row and opening paragraph, to include `@opentheme/react` and feature 006
- [ ] T016 Run `pnpm build` and `pnpm verify:correctness`; fix anything that fails; record the results (test counts, size) in `specs/006-react-bindings/checklists/requirements.md` under "Implementation Results"; mark every task `[X]`

## Dependencies

Setup → Foundational → US1 → US2 → US3 → Polish. Tests before implementation in each story.

## Rules for the implementer

- Commit after every task, with a message in the repository's style (`feat(react): …`,
  `test(react): …`, `docs(006): …`) and real-time dates; never rewrite history.
- Do not change `packages/core`, `packages/web`, the specification, or conformance fixtures. If the
  bindings seem to need a change there, stop and report it instead.
- Every result must come from the Web adapter or Core; do not copy their logic.
