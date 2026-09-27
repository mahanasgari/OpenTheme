# @opentheme/core — agent guide

How to integrate `@opentheme/core` correctly. The README covers the API; this guide covers the
decisions an integration has to get right. Examples use the same `auroraBytes`, `graphiteBytes`,
and `notesHostBytes` placeholders as the README, and are type-checked and run by the tests.

## Integration pattern

1. Create one Core per application: `createCore(settings)`.
2. Admit every theme you ship with `trust: "trusted"`, and your host declaration.
3. Admit user-supplied themes with `trust: "untrusted"` and the `source` that describes how you
   got them. Enable only the source categories your product actually offers.
4. Take a `snapshot()` and resolve against it, or create a controller per scope (for example,
   the whole app, or one embedded region).
5. Translate the Resolved Theme into your platform (CSS variables, native styles) in an adapter.
   Core never touches the platform.

```ts
import { createCore, type AdmissionResult } from "@opentheme/core";

const core = createCore({ untrustedSources: { "user-created": true } });
for (const bytes of [auroraBytes, graphiteBytes]) core.registry.admit({ kind: "theme", bytes, trust: "trusted" });
core.registry.admit({ kind: "host", bytes: notesHostBytes, trust: "trusted" });

function importUserTheme(bytes: string): AdmissionResult {
  // The user built this theme in the app's editor: untrusted, source "user-created".
  return core.registry.admit({ kind: "theme", bytes, trust: "untrusted", source: "user-created" });
}

const result = importUserTheme("{}");
console.log(result.status, result.diagnostics.map((d) => d.code));
```

## Trust and source rules

- Decide trust from **where the bytes came from in your code**, never from the bytes.
- `trusted` only for files in your build output. A download, an upload, a paste, a shared link,
  or AI output is `untrusted`, even when it claims `org.opentheme.*` or `provenance: "prebuilt"`.
- The `source` is your statement, not the document's. A document whose `provenance.origin`
  disagrees with your `source` is not an error, and gains nothing.
- Never set `accessibilityGate: "relaxed"` to make an import "work". Show the `OT-A11Y-003`
  diagnostics to the user instead.

## Context

Supply context exactly as the specification defines it. Compute the size class yourself (for
example from the window width in an adapter); Core accepts no pixel widths. Density is a
customization point, not context.

```ts
import { createCore } from "@opentheme/core";

const core = createCore();
const result = core.resolve(core.registry.snapshot(), {
  policy: { preset: "closed", defaultTheme: "org.opentheme.baseline" },
  selection: { id: "org.opentheme.baseline" },
  previous: null,
  preferences: {},
  platform: { colorScheme: "no-preference", contrast: "high", forcedColors: false, reducedMotion: true, textScale: 1.5 },
  environment: { sizeClass: "expanded", locale: "ar-EG", direction: "rtl" },
});
if (result.ok) console.log(result.resolved.context);
else console.log(result.error.kind, result.error.pointer); // "invalid-context" and the member
```

## Common mistakes

| Mistake | Consequence | Instead |
|---|---|---|
| Marking user imports `trusted` | Hostile themes bypass the gates | `untrusted` with a `source` |
| Reading `provenance` to pick a `source` | Documents choose their own treatment | Use how your app obtained them |
| Caching resolved output yourself | Stale results after context or policy changes | Call `resolve`; Core memoizes invisibly |
| Rewriting stored preferences after a clamp | The user's choice is lost | Store only explicit user intent; the controller does this |
| Holding a snapshot forever | New admissions never apply | Take a fresh `snapshot()`, or `controller.setSnapshot` |
| Parsing `message` text | Breaks with localization | Branch on `code` (diagnostics) or `kind` (operational errors) |

## Errors

Diagnostics (`OT-…`) are findings about documents. Operational errors (`kind`) are about the call:
refusals and caller errors. Data-dependent refusals are returned; programming errors (wrong types,
unknown presets, a disposed controller) are thrown as `OpenThemeCoreError`, which carries the same
payload in `.error`. Each kind has a page in `docs/errors/`.
