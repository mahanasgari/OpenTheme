# @opentheme/react

React bindings for [OpenTheme](../../README.md). A provider attaches the theme to your page through
[`@opentheme/web`](../web/README.md), hooks read the resolved theme and drive personalization, and a
style component server-renders the first paint.

All theming behavior lives in [`@opentheme/core`](../core/README.md) and the Web adapter: admission,
trust, validation, resolution, policy, accessibility, and CSS output. This package only connects them
to React. Supported React versions are 18.3 and 19.

Status: `0.1.0-draft.0`, pre-release, tracking Theme Specification `1.0.0-draft.5`.

## Install

```sh
pnpm add @opentheme/react @opentheme/core
```

`react` and `@opentheme/core` are peer dependencies, so your app has exactly one of each;
`@opentheme/web` comes with this package.

## Theme an app

Wrap your app in `OpenThemeProvider` with a Core instance, a scope name, and a policy. The page gets
the adapter's `--ot-` and `--otc-` custom properties before it paints, and they are removed when the
provider unmounts.

```tsx
import { createCore } from "@opentheme/core";
import { OpenThemeProvider, useOpenTheme } from "@opentheme/react";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "trusted" });

function ThemeName() {
  const { resolved } = useOpenTheme();
  return <p>{String(resolved?.displayText?.name ?? "")}</p>;
}

export function App() {
  return (
    <OpenThemeProvider core={core} scope="app" policy={{ preset: "common-personalization", defaultTheme: "org.opentheme.aurora" }}>
      <ThemeName />
    </OpenThemeProvider>
  );
}
```

Style your components with the custom properties as described in the
[Web adapter](../web/README.md#quickstart), for example `color: var(--ot-color_text_primary)`.

### Provider props

| Prop | Meaning |
|---|---|
| `core`, `scope`, `policy` | Required. `scope` matches `[a-z][a-z0-9-]*`. |
| `target` | `"document"` (default) or a ref to an element (see below). |
| `sizeClass` | `"compact"`, `"medium"` (default), `"expanded"`, or `"auto"`. |
| `textScale` | Default `1`. |
| `locale`, `initial`, `nonce` | Read when the scope is attached. |
| `store` | A preference store, or `false` for none. Default: the adapter's browser store (`opentheme:<scope>` in `localStorage`). |
| `serverResolved` | What the hooks return during server rendering. |

A change of `policy` goes to the existing controller, and `sizeClass` and `textScale` to the existing
scope; nothing is detached. A change of `core`, `target`, `scope`, or `store` replaces the scope, so
pass a stable `store` (create it once, outside render).

## Read and change the theme

`useOpenTheme()` returns `resolved`, `outcome`, `errors`, `report`, the `controller`, and the
controller's actions: `select`, `setValue`, `clearValue`, `reset`, `preview`, `acceptPreview`, and
`cancelPreview`. A component re-renders only when Core publishes a changed resolution.
`useThemeValue(path)` reads one value by token path or `<contract>.<part>.<property>[.<state>]`, and
returns `undefined` for an unknown path.

```tsx
import { createCore } from "@opentheme/core";
import { OpenThemeProvider, useOpenTheme, useThemeValue } from "@opentheme/react";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "trusted" });

function Picker() {
  const { resolved, select, setValue } = useOpenTheme();
  const text = useThemeValue("color.text.primary");
  return (
    <div>
      <p data-text={JSON.stringify(text)}>Now: {String(resolved?.displayText?.name ?? "")}</p>
      <button onClick={() => void select({ id: "org.opentheme.graphite" })}>Graphite</button>
      <button onClick={() => void setValue("std.density", "compact")}>Compact</button>
    </div>
  );
}

export function App() {
  return (
    <OpenThemeProvider core={core} scope="app" policy={{ preset: "common-personalization", defaultTheme: "org.opentheme.aurora" }}>
      <Picker />
    </OpenThemeProvider>
  );
}
```

`resolved` is `null` until the provider has attached (and on the server unless `serverResolved` is
given). Actions called before that reject; `preview` and `cancelPreview`, which are synchronous,
throw. A hook used outside a provider throws `useOpenTheme must be used inside <OpenThemeProvider>`
(with the hook's own name).

## Element scopes

Pass a ref to theme one part of the page. Only that element carries the scope; remember to use
`root={false}` with `OpenThemeStyle` for it.

```tsx
import { createCore } from "@opentheme/core";
import { OpenThemeProvider } from "@opentheme/react";
import { useRef } from "react";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });

export function App() {
  const panel = useRef<HTMLDivElement>(null);
  return (
    <OpenThemeProvider core={core} scope="panel" target={panel} policy={{ preset: "closed", defaultTheme: "org.opentheme.aurora" }}>
      <div ref={panel}>Themed panel</div>
    </OpenThemeProvider>
  );
}
```

Two providers need different scope names; reusing one is the adapter's `scope-conflict` error.

## Size class and text scale

`sizeClass="auto"` follows the window width (below 600 px compact, below 1024 px medium, otherwise
expanded) and the `resize` event. `textScale` multiplies the type scale.

```tsx
import { createCore } from "@opentheme/core";
import { OpenThemeProvider } from "@opentheme/react";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });

export function App({ scale = 1 }: { scale?: number }) {
  return (
    <OpenThemeProvider
      core={core}
      scope="app"
      policy={{ preset: "common-personalization", defaultTheme: "org.opentheme.aurora" }}
      sizeClass="auto"
      textScale={scale}
    />
  );
}
```

## Persistence

By default the provider remembers personalization in `localStorage` under `opentheme:<scope>` and
reads it before the first resolution. Pass `store={false}` to keep nothing, or your own
`PreferenceStore`.

```tsx
import { createCore, type PreferenceStore } from "@opentheme/core";
import { OpenThemeProvider } from "@opentheme/react";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });

const memory = new Map<string, string>();
const store: PreferenceStore = {
  read: async (scope) => memory.get(scope) ?? null,
  write: async (scope, bytes) => void memory.set(scope, bytes),
  clear: async (scope) => void memory.delete(scope),
};

export function App() {
  return <OpenThemeProvider core={core} scope="app" store={store} policy={{ preset: "closed", defaultTheme: "org.opentheme.aurora" }} />;
}
```

## Server rendering

Resolve the theme on the server with Core, render `OpenThemeStyle` into the page head, and give the
same resolution to the provider as `serverResolved`. On the client the provider adopts the style
element, so the first paint is already themed and nothing is rewritten when the inputs match.

```tsx
import { createCore, type PolicyInput } from "@opentheme/core";
import { OpenThemeProvider, OpenThemeStyle, useOpenTheme } from "@opentheme/react";
import { renderToString } from "react-dom/server";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });

const policy: PolicyInput = { preset: "closed", defaultTheme: "org.opentheme.aurora" };

// On the server, per request: resolve with the context you know (here the defaults).
const server = core.createController({
  policy,
  context: {
    platform: { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
  },
});
const resolved = server.current.resolved;
server.dispose();

function Name() {
  return <p>{String(useOpenTheme().resolved?.displayText?.name ?? "")}</p>;
}

function App() {
  return (
    <OpenThemeProvider core={core} scope="app" policy={policy} serverResolved={resolved}>
      <Name />
    </OpenThemeProvider>
  );
}

// Put `head` inside <head> and `body` in the page; the client renders <App /> over it.
export const head = renderToString(<OpenThemeStyle resolved={resolved} scope="app" />);
export const body = renderToString(<App />);
export { App };
```

Pass the same `nonce` to `OpenThemeStyle` and to the provider when you use a Content Security Policy
nonce. For an element scope, render `<OpenThemeStyle root={false} … />` and put the same scope
attribute on the element. The provider never touches browser APIs while rendering on the server.

## Strict mode and errors

Under `React.StrictMode` the provider attaches, detaches, and attaches again, and ends with exactly
one scope. Errors from the adapter (an invalid scope id, a `scope-conflict`) are thrown while
rendering, so an error boundary can catch them. Operational errors from Core's controller, such as a
failed preference write, are in `errors` from `useOpenTheme()`.

## License

Apache-2.0.
