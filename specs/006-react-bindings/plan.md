# Implementation Plan: React Bindings

**Branch**: `006-react-bindings` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

## Summary

`@opentheme/react`: `OpenThemeProvider` attaches one Web adapter scope per subtree in a layout
effect, `useOpenTheme` and `useThemeValue` read the published resolution through
`useSyncExternalStore` with a provider-owned snapshot, and `OpenThemeStyle` server-renders the
adapter's style element for adoption. No theming behavior is added (research RR1 to RR8).

## Technical Context

**Language/Version**: TypeScript 6, ES2022 ESM, `jsx: react-jsx`
**Primary Dependencies**: React 18.3 or 19 (peer), `@opentheme/core` (peer), `@opentheme/web`
**Testing**: Vitest + happy-dom + `react-dom/client` + `react-dom/server`
**Target Platform**: browsers; server rendering in Node
**Project Type**: library (`packages/react`)
**Performance Goals**: no work beyond the adapter's; re-render only on published changes
**Constraints**: ≤ 3 KB gzip over React, Core, and the adapter; no browser API on the server
**Scale/Scope**: one provider per scope; any number of hook consumers

## Constitution Check

| Principle | Result | Evidence |
|---|---|---|
| I–III Separation, personalization, boundaries | Pass | Personalization actions are Core's controller methods; policy passes through |
| IV Specification | Pass | No theme capability added |
| V Thin adapters | Pass | Every result from the Web adapter and Core (FR-R001); equivalence tests |
| VI Security (non-negotiable) | Pass | CSS only from the adapter's serializers; `dangerouslySetInnerHTML` only with `toStylesheet` output, which never contains `<` |
| VII AI (non-negotiable) | Pass | No AI surface |
| VIII Accessibility | Pass | Context, floors, and forced colors stay in Core and the adapter |
| IX Compatibility | Pass | Versioned contract; React 18.3 and 19 |
| X Determinism | Pass | Same inputs, same properties (SC-R001) |
| XI Developer experience | Pass | README examples run in CI |
| XII No required cloud (non-negotiable) | Pass | Offline |
| XIII Extensibility | Pass | No plug-ins |

## Project Structure

```text
packages/react/
├── package.json  tsconfig.json  vitest.config.ts
├── scripts/size.ts
├── src/{index.ts, provider.tsx, hooks.ts, style.tsx, store.ts, path.ts}
├── test/{helpers.ts, provider.test.tsx, hooks.test.tsx, ssr.test.tsx, strict.test.tsx, docs/examples.test.ts}
└── README.md
```

## Delivery Phases

1. Scaffold, workspace wiring, boundary lint entry, size gate.
2. US1: provider and its tests.
3. US2: hooks and their tests.
4. US3: style component, server rendering, adoption tests.
5. Polish: README with CI-run examples, root docs, `pnpm verify`.

## Complexity Tracking

None.
