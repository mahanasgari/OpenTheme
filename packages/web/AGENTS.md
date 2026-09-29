# Agent Guide: @opentheme/web

For agents integrating OpenTheme into a web app. Read [README.md](./README.md) first; Core's rules
are in [../core/AGENTS.md](../core/AGENTS.md).

## Integration pattern

1. Create one Core, admit bundled themes as `trusted`, user or imported themes as `untrusted` with
   a `source`.
2. Call `attachTheme` once per scope, as early as possible (before first paint when you can), with
   the host's policy and size class.
3. Style the page with the `--ot-` and `--otc-` custom properties; never with the theme's raw
   values.
4. Wire personalization UI to `scope.controller` (`select`, `setValue`, `preview`, `reset`).
5. On teardown call `scope.detach()`.

```ts
import { createCore } from "@opentheme/core";
import { attachTheme, sizeClassForWidth } from "@opentheme/web";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
const scope = attachTheme({
  core,
  target: document,
  scope: "app",
  policy: { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" },
  sizeClass: sizeClassForWidth(1280),
  store: false,
});
scope.controller.preview({ values: { "std.color-scheme": "dark" } });
await scope.controller.acceptPreview();
console.log(scope.errors.length); // 0
scope.detach();
```

## What the adapter never does

- Decide trust, validate themes, resolve values, or apply policy: that is Core.
- Execute or evaluate anything from a theme.
- Write a name or value outside the CSS output contract; those are omitted and reported.
- Send preferences anywhere; they stay in the browser's storage.
- Guess context: unavailable media features take Core's defaults, and the size class comes from
  the host.

## Common mistakes

| Mistake | Instead |
|---|---|
| Hand-writing `--color-primary` style names | Use the contract names (`--ot-color_action_primary_background`) |
| Admitting user themes as `trusted` | Trust comes from where the bytes came from, never from their content |
| Reading `window.innerWidth` inside the adapter's callbacks | Compute the size class in the host and call `setSizeClass` |
| Two `attachTheme` calls on one element | One scope per target; detach first |
| Reusing a scope id for two targets | Scope ids are also storage keys; keep them unique per page |
| Expecting typography shorthands | Use the members (`___font-size`, `___line-height`, ...) |
