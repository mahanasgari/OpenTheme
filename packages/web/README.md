# @opentheme/web

The Web adapter for [OpenTheme](../../README.md). It applies the themes that
[`@opentheme/core`](../core/README.md) resolves to web pages as CSS custom properties, keeps them
current as the user's system settings change, and remembers personalization on the device.

All theming behavior lives in Core: admission, trust, validation, resolution, policy, and
accessibility. The adapter only translates Core's result into CSS and feeds Core the browser's
context. It has no runtime dependency besides Core and works with any framework or none.

Status: `0.1.0-draft.0`, pre-release, tracking Theme Specification `1.0.0-draft.3`.

## Quickstart

```ts
import { createCore } from "@opentheme/core";
import { attachTheme } from "@opentheme/web";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "trusted" });

const scope = attachTheme({
  core,
  target: document,
  scope: "app",
  policy: { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" },
  sizeClass: "medium",
});

// The user picks a theme; the page updates and the choice is remembered on this device.
await scope.controller.select({ id: "org.opentheme.graphite" });
console.log(scope.report.set, "properties changed");
scope.detach();
```

Stylesheets then use the custom properties:

```css
body {
  background: var(--ot-color_surface_base);
  color: var(--ot-color_text_primary);
  font-family: var(--ot-text_body___font-family);
}
button {
  background: var(--otc-std__button_container_background_default);
  border-radius: var(--otc-std__button_container_corner-radius_default);
}
button:hover {
  background: var(--otc-std__button_container_background_hover);
}
```

## Names

Every name encodes a path from the Resolved Theme, so it is predictable and works for every theme:

| Resolved path | Custom property |
|---|---|
| token `color.text.primary` | `--ot-color_text_primary` |
| member `fontSize` of token `text.body` | `--ot-text_body___font-size` |
| host token `com.example.notes/color.rail` | `--ot-com_example_notes__color_rail` |
| `std/button`, part `container`, property `background`, state `hover` | `--otc-std__button_container_background_hover` |
| the same with variant `emphasis=primary` | `--otc-std__button_v_emphasis_primary_container_background_hover` |

`.` becomes `_`, a namespace ends with `__`, and a composite member starts with `___`. Border and
shadow composites are also written as one shorthand value (`--ot-border_default`); typography is
written only as members. The full naming and value contract is
[`specs/003-web-adapter/contracts/css-output.md`](../../specs/003-web-adapter/contracts/css-output.md).
A name or value outside that contract is never written; it is listed in `scope.report.omissions`.

## Forced colors

When the system forces colors, Core resolves colors to system roles and the adapter writes the
matching CSS system colors (`Canvas`, `CanvasText`, `ButtonFace`, and so on), so the page follows
the user's palette without extra CSS.

## Scopes

A scope is the document (`:root`) or one element. Each scope has its own controller, preferences,
and rule, so a page can show more than one theme:

```ts
import { createCore } from "@opentheme/core";
import { attachTheme } from "@opentheme/web";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "trusted" });

const preview = document.createElement("section");
document.body.append(preview);
const page = attachTheme({
  core,
  target: document,
  scope: "page",
  policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
  sizeClass: "expanded",
  store: false,
});
const panel = attachTheme({
  core,
  target: preview,
  scope: "preview",
  policy: { preset: "closed", defaultTheme: "org.opentheme.graphite" },
  sizeClass: "compact",
  store: false,
});
console.log(preview.getAttribute("data-opentheme-scope")); // "preview"
panel.detach();
page.detach();
```

`detach()` removes the rule, the style element, the scope attribute, and every listener. Attaching
a second scope to a managed target, or reusing a scope id, throws an `OpenThemeWebError` of kind
`scope-conflict`.

## Context

The adapter reads `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, and
`prefers-reduced-motion`, and the nearest `lang` and `dir` attributes, and updates Core only when
one of them really changes. The size class and text scale come from the host; two helpers cover
the common cases:

```ts
import { sizeClassForWidth, textScaleFromRoot } from "@opentheme/web";

console.log(sizeClassForWidth(800)); // "medium" (compact below 600 px, expanded from 1024 px)
console.log(textScaleFromRoot(document)); // root font size / 16
```

Call `scope.setSizeClass(...)` and `scope.setTextScale(...)` when they change.

## Server rendering

Render the same element on the server so the first paint already has the right theme. The client
adopts it and writes nothing when it matches:

```ts
import { createCore } from "@opentheme/core";
import { toStylesheet } from "@opentheme/web";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
const result = core.resolve(core.registry.snapshot(), {
  policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
  selection: { id: "org.opentheme.aurora" },
  previous: null,
  preferences: {},
  platform: { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
  environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
});
if (result.ok) {
  const html = toStylesheet(result.resolved, { scope: "app", root: true, element: true, nonce: "rAnd0m" });
  console.log(html.startsWith('<style data-opentheme-scope="app" nonce="rAnd0m">:root {')); // true
}
```

`toDeclarations(resolved)` returns the same declarations as data, in name order.

## Persistence

By default a scope stores the user's preferences document in `localStorage` under
`opentheme:<scope>` and reads it synchronously before the first resolution. Pass
`createBrowserStore({ storage, prefix })` to change where, your own Core `PreferenceStore`, or
`store: false` to keep nothing. Storage failures never break the page: the theme still applies and
`scope.errors` lists `store-read-failed` or `store-write-failed`. Preferences never leave the device.

## Content Security Policy

Values are written through the CSS object model, which a Content Security Policy's inline-style
checks do not block, so a strict policy works without `unsafe-inline`. For the server-rendered
element, pass the page's `nonce` to `toStylesheet` and to `attachTheme`.

## Safety

The adapter never executes theme content. It writes only typed values through fixed serializers,
names only from grammar-checked segments, and family names quoted and escaped. Every malicious and
invalid conformance fixture is part of its test suite.
