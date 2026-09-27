# Quickstart and Validation Guide: OpenTheme Core Runtime

**Feature**: `002-core-runtime` | **Contracts**: [contracts/](./contracts/) |
**Data model**: [data-model.md](./data-model.md)

This guide lists the runnable scenarios that prove the feature works. The quickstart in
scenario 1 is also an automated CI test (SC-C004; constitution XI).

## Prerequisites

- Node.js ≥ 24 and pnpm ≥ 10, from the repository root.
- Foundation prerequisites P1–P3 merged (research.md, "Foundation prerequisites").
- `pnpm install && pnpm build`

## Scenario 1: ship prebuilt themes with zero theme authoring (US1)

The steps, which `packages/core/test/quickstart.test.ts` runs verbatim:

1. `createCore()` with default settings.
2. Admit `specification/themes/reference/org.opentheme.aurora.opentheme.json` and
   `…graphite…` as `trust: "trusted"`. Admit `specification/hosts/com.example.notes.opentheme-host.json`.
3. Resolve with `policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" }`,
   `selection: { id: "org.opentheme.aurora" }`, `previous: null`, and a light / standard /
   medium / `en` / `ltr` context.

**Expected**: `ok: true`, `outcome: "selected"`, `applied.fallback: "none"`, and every standard
token and contract property present. The JCS bytes equal the reference checker's output for the
equivalent resolution input.

## Scenario 2: hostile input never applies (US2)

- Admit any malicious fixture as untrusted with `source: "imported"` while `imported` is
  disabled → `status: "refused"`, kind `source-not-allowed`, nothing parsed.
- Enable `imported`, then admit the same fixture → `status: "invalid"` with the fixture's
  expected diagnostics. It never appears in `listSelectable`.
- Admit an untrusted impostor of `org.opentheme.aurora` → the trusted document stays selected,
  with `OT-SEC-001`, whatever the admission order.
- Admit a valid untrusted theme with a dark-mode AA shortfall → kind `accessibility-gate` with
  its `OT-A11Y-003` diagnostics. The same bytes admitted as trusted → registered, and the
  shortfall is reported only.

## Scenario 3: live context changes (US3)

With a controller from scenario 1, subscribe, then:

- `setContext({ platform: { …, contrast: "high" } })` → exactly one notification, `context.contrast: "high"`, same theme.
- Repeat the identical call → no notification.
- `reducedMotion: true` → every `motion.duration.*` is its reduced value.

## Scenario 4: personalization, preview, persistence (US4)

With `createMemoryStore()` and `preset: "common-personalization"`:

- `setValue("std.text-size", 5)` → the result reports `clamped`; `store.read()` still contains `5`.
- `preview({ selection: { id: "org.opentheme.graphite" } })` → the controller publishes Graphite,
  and the store is unchanged. `cancelPreview()` → the prior bytes are restored exactly.
- `reset()` → equals resolving the developer default with no values.
- Make the store fail on write → the result still updates, and `errors` contains
  `store-write-failed`.

## Scenario 5: preferences document handling (FR-C067 to FR-C069)

- `pnpm conformance:core -- --filter 'preferences/*'` → all `validate-preferences` fixtures pass.
- A document with `openthemePreferences: "1.9"` → `OT-PREF-004`, treated as absent, and the stored
  bytes are not overwritten.

## Scenario 6: full verification

```bash
pnpm verify
```

**Expected**: every step green. This includes `conformance:core` (every fixture passes with zero
unsupported), `sweeps:core`, `crosscheck:core` (zero byte differences), `bench:core` (R22 budgets:
≤ 25 ms, ≤ 250 ms, ≤ 5 ms, ≤ 4 ms), and `size:core` (≤ 100 KB compressed).
