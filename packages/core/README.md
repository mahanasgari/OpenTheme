# @opentheme/core

The framework-agnostic OpenTheme runtime. It admits theme documents under an explicit trust
model, keeps them in a registry, and resolves them deterministically, exactly as the OpenTheme
Theme Specification 1.0 defines. It performs no I/O and reads no platform state: your app (or an
adapter) supplies bytes, context, and storage.

- Pure, synchronous resolution: the same inputs give the same bytes, on every runtime.
- Untrusted themes are validated, gated, and never trusted by their content.
- No DOM, Node, or framework types. No dependencies at runtime.

Status: `0.1.0-draft`, tracking specification `1.0.0-draft.4`.

In the examples, `auroraBytes`, `graphiteBytes`, and `notesHostBytes` are the contents of
`org.opentheme.aurora.opentheme.json`, `org.opentheme.graphite.opentheme.json`, and
`com.example.notes.opentheme-host.json`, loaded however your app loads files. Every example is
type-checked and run by the test suite.

## Quickstart

Ship prebuilt themes with zero theme authoring:

```ts
import { createCore } from "@opentheme/core";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "trusted" });
core.registry.admit({ kind: "host", bytes: notesHostBytes, trust: "trusted" });

const result = core.resolve(core.registry.snapshot(), {
  policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
  selection: { id: "org.opentheme.aurora" },
  previous: null,
  preferences: {},
  platform: { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
  environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
});

if (!result.ok) throw new Error(result.error.message);
const tokens = result.resolved.tokens as Record<string, unknown>;
console.log(result.outcome, tokens["color.text.primary"]); // "selected" { srgb8: [...], alpha: 1 }
```

`resolved` is the specification's Resolved Theme, deeply frozen: every standard token and every
contract property, plus the applied theme, context, preference statuses, accessibility report,
and diagnostics.

## Trust model

Trust is assigned by you, per document, when you admit it. Core never infers it from the
document: not from its id, author, provenance, version, `$extensions`, or an AI-generated flag.

- `trust: "trusted"` means **bundled by you at build time**. Asserting it for anything else is an
  integration error.
- Everything else is `trust: "untrusted"` and needs a `source`: `user-created`, `imported`,
  `shared`, or `ai-generated`, chosen from how your app obtained the bytes.
- Every source category is **off** by default. An untrusted admission from a disabled category is
  refused before a single byte is parsed.
- An untrusted theme that misses WCAG 2.2 AA in any mode it supports is refused by the
  accessibility gate. Trusted themes are never refused; their shortfalls are only reported.
- An untrusted document can never replace, shadow, or impersonate a trusted one with the same id.
- The specification baseline theme is built in and always available as the last fallback.

```ts
import { createCore } from "@opentheme/core";

const core = createCore({ untrustedSources: { imported: true } });
const refused = core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "untrusted", source: "shared" });
console.log(refused.status, refused.error?.kind); // "refused" "source-not-allowed"

const imported = core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "untrusted", source: "imported" });
console.log(imported.status, imported.entry?.trust); // "registered" "untrusted"
```

Refusals and caller errors are **operational errors**: `{ kind, operation, pointer?, message,
hint, docs }`, with kinds such as `trust-missing` or `invalid-context`. Findings about a document
are **diagnostics** with `OT-` codes from the specification. See `docs/errors/` for every kind.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `untrustedSources.<category>` | `false` | Accept untrusted themes from that source |
| `accessibilityGate` | `"enforce"` | `"relaxed"` admits untrusted themes below AA, still reporting them |
| `registryCapacity` | `256` | More admissions are refused; nothing is evicted |
| `cache.results` | `32` | Memoized resolutions (`0` disables; never changes output) |

`core.updateSettings({ untrustedSources, accessibilityGate })` changes the first two later.
Entries from a category you turn off stop being selectable from the next snapshot on.

## Policies and presets

A policy is the developer's contract: which themes are available, the default theme, which
customization points users may change (optionally narrowed), locks, protected paths, and the
accessibility floor. Two presets cover the common cases:

- `closed`: only your trusted themes, no user customization, light and dark, AA floor.
- `common-personalization`: the same, plus the seven standard points (accent, color scheme,
  contrast, text size, density, corner roundness, motion).

```ts
import { createCore } from "@opentheme/core";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
const snapshot = core.registry.snapshot();
const policy = { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" } as const;

for (const theme of core.listSelectable(snapshot, policy, "en")) console.log(theme.id, theme.name);
const custom = core.describeCustomization(snapshot, "org.opentheme.aurora", policy, "en");
if ("points" in custom) console.log(custom.points.map((p) => p.id));
```

Anything a preset cannot say, write as the abstract policy object directly.

## Controller and persistence

The controller holds one scope's state and publishes a new result only when the output bytes
change. Enforcement (clamping, fallback) never rewrites what the user chose.

```ts
import { createCore, createMemoryStore } from "@opentheme/core";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
core.registry.admit({ kind: "theme", bytes: graphiteBytes, trust: "trusted" });

const store = createMemoryStore();
const controller = core.createController({
  policy: { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" },
  context: {
    platform: { colorScheme: "dark", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "compact", locale: "en", direction: "ltr" },
  },
  store,
});

const unsubscribe = controller.subscribe((result) => console.log("apply", result.resolved.applied));
await controller.setValue("std.text-size", 1.25); // written to the store
controller.preview({ selection: { id: "org.opentheme.graphite" } }); // shown, never written
controller.cancelPreview(); // the previous bytes, exactly
const saved = controller.exportDocument(); // canonical User Preferences document
unsubscribe();
console.log(saved);
```

A store is any object with `read`, `write`, and `clear` for a scope (synchronous or
asynchronous). Core ships only `createMemoryStore()`; storage backed by the platform belongs in
an adapter. Pass `initial` (the stored bytes, for example read during server rendering) to make
the first result available synchronously.

## Document utilities

`core.documents` offers `canonicalize` (canonical JSON and integrity), `flatten`, `exportCheck`,
`compareVersions`, and `migrate`, with the specification's semantics. `core.preferences`
parses, serializes, and creates User Preferences documents.

## Schemas

The JSON Schemas Core validates against ship with the package, unchanged, under `schemas/`
(for example `@opentheme/core/schemas/1.0/theme.schema.json`,
`…/1.0/resolved-theme.schema.json`, and `…/user-preferences/1.0/user-preferences.schema.json`).
Use them to validate or generate types for what you store or send; Core itself needs no schema
files at run time.

## English messages

Diagnostics carry codes and parameters, not prose. For English text, import the optional
templates module, which is not part of the main bundle:

```ts
import { createCore } from "@opentheme/core";
import { formatDiagnostic } from "@opentheme/core/templates";

const result = createCore().registry.admit({ kind: "theme", bytes: "{", trust: "trusted" });
for (const d of result.diagnostics) console.log(d.code, formatDiagnostic(d)?.message);
```
