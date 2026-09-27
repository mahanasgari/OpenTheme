# Contract: Core Conformance Harness and Runner Extensions

**Spec**: FR-C110, FR-C111, SC-C001 to SC-C003 | **Foundation protocol**:
`specs/001-theme-specification-foundation/contracts/conformance.md` (unchanged except where
marked *additive*).

## Core harness

- Package `packages/core-conformance` (private). Command: `node packages/core-conformance/dist/main.js serve-conformance`.
- Speaks NDJSON protocol 1 and replies to the handshake with:

  ```json
  {"type":"hello","implementation":"@opentheme/core","version":"0.1.0","supports":["validate","validate-host","resolve","canonicalize","flatten","export-check","compare-versions","migrate","kernel","validate-preferences","accessibility-report"]}
  ```

- It maps each request to the public API only (plus the internal kernel entry point for `kernel`).
  **Fixture trust mapping**: a `themes[].trust` value is passed through as-is. The `theme`
  shorthand is admitted as trusted, as the schema defines. Harness admissions use settings that
  allow every untrusted source and set `accessibilityGate: "relaxed"`, because the Foundation
  fixtures test the specification, not Core's host gates. Untrusted fixture entries are
  admitted with source `imported`; the source never affects resolution. The gates have their own Core tests
  (SC-C012, SC-C013).
- The harness never executes fixture content and never reads files outside the paths allowed
  for `$file` (already resolved by the runner).

## Runner extensions (Foundation prerequisites, additive)

| Id | Change | Default behavior |
|---|---|---|
| P2 | `--sweeps` accepts `--impl`. Sweeps (SC-014, SC-015, official themes, host coverage) generate their resolution inputs and send them as `resolve` requests over the protocol, asserting the same properties as today | Unchanged (the default `--impl` is the reference checker) |
| P3 | New kind `validate-preferences` (see user-preferences-document.md) | The reference checker implements it |

## Root scripts (added)

| Script | Runs |
|---|---|
| `pnpm conformance:core` | Runner with `--impl` pointing at the Core harness: every fixture |
| `pnpm sweeps:core` | Runner `--sweeps --impl …core…` |
| `pnpm crosscheck:core` | Sends every fixture and sweep request to both implementations and compares JCS bytes of the results (SC-C002) |
| `pnpm bench:core` | Core benchmarks with the R22 budgets (NFR-C001) |
| `pnpm size:core` | Bundle-size check against the 100 KB limit (research CR16) |

`pnpm verify` becomes: `spec:check`, `test`, `conformance`, `conformance:core`, `sweeps`,
`sweeps:core`, `crosscheck:core`, `kernels:crosscheck` (extended to Core's kernels), `bench`,
`bench:core`, `size:core`.

## Pass criteria

- `conformance:core`: 100% pass with zero `unsupported` results (SC-C001).
- `crosscheck:core`: zero byte differences. A difference fails the build and is resolved against
  the specification, never by special-casing either implementation (SC-C002).
