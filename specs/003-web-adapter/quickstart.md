# Quickstart and Validation Guide: OpenTheme Web Adapter

**Feature**: `003-web-adapter` | **Contracts**: [contracts/](./contracts/) | **Data model**:
[data-model.md](./data-model.md)

Runnable scenarios that prove the feature works. Scenario 1 is also an automated test.

## Prerequisites

- Node.js 24 or later and pnpm 10, from the repository root: `pnpm install && pnpm build`.

## Scenario 1: theme a page (US1)

`packages/web/test/quickstart.test.ts` runs this verbatim in a DOM test environment:

1. `createCore()`, admit Aurora and Graphite as trusted and the notes host.
2. `attachTheme({ core, target: document, scope: "app", policy: { preset: "closed", defaultTheme:
   "org.opentheme.aurora" }, sizeClass: "medium", store: false })`.
3. Read `--ot-color_text_primary` and `--otc-std__button_container_background_default` from
   the scope's `:root` rule (the DOM test environment's computed style ignores CSS object model
   writes; the browser page reads computed style in a real browser).

**Expected**: both are set, equal to Aurora's resolved values serialized per
[contracts/css-output.md](./contracts/css-output.md); `detach()` leaves no `data-opentheme-scope`
element, attribute, or property behind.

## Scenario 2: output-target conformance (FR-W050)

```bash
pnpm conformance:web
```

**Expected**: for every Core resolution fixture, decoding the declarations reproduces Core's
resolved tokens and components (JCS-identical), with zero unexpected omissions.

## Scenario 3: live context (US2)

In the DOM test environment, flip `prefers-color-scheme` to `dark`, then send the same signal
again.

**Expected**: exactly one controller update and the dark values applied; the repeated signal causes
no writes.

## Scenario 4: persistence and failures (US3)

- Set a value, re-attach with the same scope id: the value is used by the first resolution.
- Replace storage with one that throws: preferences still apply; the controller's `errors` list
  `store-write-failed`; no uncaught error.

## Scenario 5: first paint (US4)

`toStylesheet(resolved, { element: true })` produces the server-rendered element. Attaching on a
page that already contains it with the same inputs performs zero `setProperty` calls.

## Scenario 6: safety (US5)

Admit every malicious and invalid Core fixture as untrusted and apply what resolves.

**Expected**: every written value matches the serialization grammar; font names are quoted and
escaped; the stylesheet has exactly one rule per scope.

## Scenario 7: full verification

```bash
pnpm verify
```

**Expected**: green, including `conformance:web`, `size:web` (≤ 10 KB gzip over Core), and
`bench:web` (≤ 4 ms apply and update medians).
