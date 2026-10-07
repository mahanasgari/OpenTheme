# Research: React Bindings

**Feature**: `006-react-bindings` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## RR1. Package and dependencies

- **Decision**: `packages/react` (`@opentheme/react`), TypeScript ES2022 ESM, compiled with
  `tsc` (`"jsx": "react-jsx"`). `peerDependencies`: `react` `^18.3 || ^19`, `@opentheme/core`
  `workspace:^`; `dependencies`: `@opentheme/web` `workspace:^`. Dev: `react`, `react-dom`,
  `@types/react`, `@types/react-dom` (19.x), `happy-dom`, `esbuild`, `tsx`, `typescript`.
- **Rationale**: Core is a peer so an app has exactly one Core; the adapter is an implementation
  detail of the bindings.

## RR2. Attaching the scope

- **Decision**: The provider calls `attachTheme` in `useLayoutEffect` (client only, before paint)
  and `scope.detach()` in its cleanup. Strict mode's mount, unmount, mount therefore attaches,
  detaches, and attaches again; the adapter allows re-attaching a detached target. The effect's
  dependencies are `core`, the resolved target (the document or the element from the ref), `scope`,
  and `store`; `policy` goes through `controller.setPolicy`, `sizeClass` through
  `scope.setSizeClass`, `textScale` through `scope.setTextScale`, each in its own effect.
  `initial`, `locale`, and `nonce` are read at attach time only (documented).
- **Rationale**: Mirrors the adapter's lifecycle exactly; a layout effect avoids a frame without
  the theme on the client.
- **Policy identity**: object literals change identity on every render; the provider compares the
  policy by `JSON.stringify` before calling `setPolicy`.

## RR3. Reading the theme

- **Decision**: The provider keeps the attached `WebScope` in state and exposes it through context.
  The snapshot is a small store owned by the provider: it holds the last result the controller
  published (initially `controller.current` right after attaching) and is replaced only inside the
  `controller.subscribe` callback. Do **not** use `() => controller.current` as the snapshot getter:
  after a refresh that publishes nothing, Core may return a new object with identical content, which
  breaks `useSyncExternalStore`'s cached-snapshot rule. The controller publishes only when the
  resolution's bytes change, so components re-render only on real changes. `getServerSnapshot`
  returns the provider's `serverResolved` prop, or `null`.
- **Return value of `useOpenTheme()`**: `{ resolved, outcome, errors, report, controller, select,
  setValue, clearValue, reset, preview, acceptPreview, cancelPreview }`, where `resolved` is `null`
  until attached (or `serverResolved` during server rendering). Actions are the controller's
  methods, bound.
- **`useThemeValue(path)`**: a token path (`color.text.primary`) or a component path
  (`std/button.container.background.default`), resolved like `opentheme resolve --path`; it returns
  `undefined` for an unknown path. It selects from the snapshot with `useSyncExternalStore` and
  returns the same reference while the value is unchanged.

## RR4. Server rendering

- **Decision**: `<OpenThemeStyle resolved scope="app" root nonce />` renders
  `<style data-opentheme-scope="app" nonce=…>` whose content is the rule text from
  `toStylesheet(resolved, { scope, root })` through `dangerouslySetInnerHTML`. The text comes from
  the adapter's grammar-checked serializers, which never produce `<`, so it cannot close the element.
  The provider, mounted with the same scope id, lets `attachTheme` adopt it (zero writes when
  unchanged).
- **Rationale**: Same element the adapter's `toStylesheet(…, { element: true })` emits, so adoption
  works unchanged.

## RR5. Size class

- **Decision**: `sizeClass` accepts `"compact" | "medium" | "expanded" | "auto"` (default `"medium"`).
  `"auto"` computes `sizeClassForWidth(window.innerWidth)` at attach and on `resize` (listener
  removed on unmount).

## RR6. Errors

- **Decision**: Errors thrown by `attachTheme` (for example `scope-conflict`) are rethrown during
  render of the next update, so React error boundaries catch them. A hook used outside a provider
  throws `Error("useOpenTheme must be used inside <OpenThemeProvider>")`.

## RR7. Testing

- **Decision**: Vitest with `happy-dom`, `react-dom/client` `createRoot` and `act`, and
  `react-dom/server` `renderToString` for the style component. Tests: equivalence of applied
  properties with `attachTheme` (read through the scope's CSSOM rule, as the Web adapter's tests do,
  because happy-dom's computed style ignores CSSOM writes), re-render counts with a render counter,
  strict mode, element targets, prop updates, unmount, outside-provider errors, server rendering and
  adoption with zero writes (spy on the rule's style), and README examples (`tsx` blocks transpiled
  with `jsx: react-jsx` and run).
- Node 26 provides a broken global `localStorage`; reuse `packages/web/test/setup.ts` as a setup
  file, as `packages/playground` does.

## RR8. Size

- **Decision**: `size:react` bundles `dist/index.js` with React, Core, and the Web adapter external,
  minified, gzip; budget 3 KB (SC-R005).
