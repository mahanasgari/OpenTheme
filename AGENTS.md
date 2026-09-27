# OpenTheme — agent guide

OpenTheme is an open-source, domain-agnostic theme specification and conformance suite.
This repository delivers Theme Specification 1.0 artifacts, private verification tooling, and
the OpenTheme Core runtime (`packages/core`, feature `specs/002-core-runtime`). It does **not**
ship adapters or output targets.

## Layout

| Path | Role |
|------|------|
| `specification/` | Normative deliverables: prose chapters, JSON Schemas, registries, themes, hosts, examples |
| `conformance/` | Fixtures, sweeps, and the implementation-agnostic runner |
| `tools/` | Private, non-normative tooling (reference checker, types, spec-lint, bench, kernel cross-check) |
| `packages/` | Core runtime `@opentheme/core` and its private conformance harness |
| `evaluations/` | Manual protocols for human/AI success criteria (not in CI) |
| `specs/` | Spec Kit feature docs (plan, research, tasks) |

## Commands

Run from the repository root with Node.js ≥ 24 and pnpm ≥ 10:

```bash
pnpm install
pnpm build
pnpm test
pnpm spec:check
pnpm conformance
pnpm sweeps
pnpm kernels:crosscheck
pnpm bench
pnpm bench:browser
pnpm verify
pnpm release:check
```

`pnpm verify` runs every gate, in the order defined by the root `package.json`. The Core gates
(`conformance:core`, `sweeps:core`, `crosscheck:core`, `bench:core`, `size:core`) run the same
conformance suite against `packages/core`. Run sweeps against any implementation with
`node conformance/runner/dist/main.js --sweeps --impl "<command>"`. The runner's `--filter`
glob matches one path segment per `*`; use `**` to match nested fixture ids.

## Invariants

1. **The specification is normative.** Schemas, registries, chapters, and fixtures define
   required behavior. The reference checker (`ot-ref`) is private and non-normative; it must not
   invent expected results.
2. **No platform math** in `tools/reference-checker/src/{kernels,color,transforms}/**`. Use only
   the normative binary64 kernels. Do not call `Math.pow`, `cbrt`, `sin`, `cos`, `log`, `exp`,
   `hypot`, `atan2`, `fround`, `round`, or the `**` operator in those modules.
3. **No network access** in validation or resolution. Do not use `fetch`, `node:http`,
   `node:https`, `node:net`, `XMLHttpRequest`, or `WebSocket` under `tools/reference-checker/src/**`.
4. **Diagnostic codes** come only from `specification/registry/1.0/diagnostics.json`. Never invent
   ad-hoc codes in tooling.
5. **Fixtures** live under `conformance/fixtures/`. A fixture id is its path relative to that
   directory without `.json`. Every fixture names at least one rule in `rules` (NFR-010).
6. **Prose line length** is 100 characters (markdownlint MD013) for `specification/**/*.md`,
   `evaluations/**/*.md`, and `AGENTS.md`. Tables and code blocks are excluded.
7. **Security review**: changes under `tools/reference-checker/src/parse/` or
   `packages/core/src/{parse,admission,registry,canonical,preferences}/` (or limit enforcement
   / serialization of untrusted input) need a recorded security-focused review.
8. **Core independence**: `packages/core` MUST NOT import, vendor, or copy the reference checker.
   Both implement the specification independently; they meet only in the conformance runner.
9. **Trust**: every theme entry carries host-assigned trust (`themes[].trust`). Never infer
   trust from a document's id, provenance, or other content.

## Official identifiers

- Themes: `org.opentheme.baseline`, `org.opentheme.aurora`, `org.opentheme.graphite`
- Hosts: `com.example.notes`, `com.example.media`
- Draft specification version: `1.0.0-draft.1`
- Themes and hosts target `"opentheme": "1.0"` / `"openthemeHost": "1.0"`

## Rule identifiers

Rules use `R-<AREA>-<NNN>`. Areas include DOC, META, TOK, REF, DRV, CTX, CMP, LAY, CUS, INH,
LIM, SEC, A11Y, VER, HOST, RES, CAN, AI, PREF, plus KRN, BAS, and EXT.

## CLI surface (`ot-ref`)

`validate`, `validate-host`, `resolve`, `canonicalize`, `flatten`, `export-check`,
`migrate`, `compare`, and `serve-conformance`. The protocol endpoint also supports the
`validate-preferences` and `accessibility-report` kinds.
