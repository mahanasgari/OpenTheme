# Implementation Plan: Design Tokens Interchange

**Branch**: `005-design-tokens-interchange` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

## Summary

Implement chapter 16 as `@opentheme/dtcg`, a library over Core, and two commands in `opentheme`.
Export resolves each mode through Core and writes DTCG 2025.10 with the declared derivation kept in
`$extensions["org.opentheme"].derive`; import maps DTCG into the `primitive` group with an optional
role and seed mapping, reports every loss, and writes only themes Core validates (IR1–IR7).

## Technical Context

**Language/Version**: TypeScript 6, ES2022 ESM, Node.js 24+ for the commands
**Primary Dependencies**: `@opentheme/core` (library); the command-line tool adds `@opentheme/dtcg`
**Storage**: files (commands only)
**Testing**: Vitest; equivalence with Core; round trip; DTCG corpus; hostile inputs
**Target Platform**: any ES2022 runtime for the library; Node.js 24+ for the commands
**Project Type**: library + command-line additions
**Performance Goals**: export and import of a typical theme under 1 s (SC-D005)
**Constraints**: no network, no code execution, deterministic output, no approximation
**Scale/Scope**: about 100 baseline tokens plus theme tokens per mode

## Constitution Check

| # | Gate | Result | Evidence |
|---|---|---|---|
| I–III | Separation, personalization, boundaries | Pass | Token interchange only; customization points and components are out of scope (chapter 16) |
| IV | Specification | Pass | Implements chapter 16; its gaps are findings D1–D3, not silent rules |
| V | Thin tools | Pass | Values from `core.resolve`, authoring form from `core.documents.flatten`, validity from Core |
| VI (non-negotiable) | Security | Pass | Imports are untrusted data: size and depth limits, `JSON.parse` only, no execution; trust is never assigned by import |
| VII (non-negotiable) | AI | Pass | No AI surface |
| VIII | Accessibility | Pass | Imported themes pass through Core validation, including the accessibility rules |
| IX | Compatibility | Pass | Library and command contracts versioned |
| X | Determinism | Pass | Sorted output, no clocks; `uid.` generation only when no `--id` is given |
| XI | Developer experience | Pass | README examples run in CI |
| XII (non-negotiable) | No required cloud | Pass | Offline |
| XIII | Extensibility | Pass | No plug-ins |

## Findings

| # | Finding | Handling |
|---|---|---|
| D1 | Chapter 16's example keeps a derivation as `{ from, via: [{ transform, args }] }`, a shape defined nowhere and unlike `$derive` (`{ op, args }`) | Keep the declared `$derive` object verbatim (IR4); recorded against chapter 16 |
| D2 | Import does not say where the required seeds come from | Optional mapping; default seeds reported (IR5) |
| D3 | Import does not say how names outside the path grammar are handled | Documented conversion; collisions reported (IR5) |

## Project Structure

```text
packages/dtcg/
├── package.json         # @opentheme/dtcg
├── scripts/generate.ts  # baseline types and default seeds → src/generated/data.ts
├── src/{index,export,import,values,names,report}.ts
├── test/
└── README.md
packages/cli/src/commands/{export,import}.ts
```

## Delivery Phases

1. Scaffold `packages/dtcg`, generator, workspace wiring, boundary lint entry.
2. Export (US1): encodings, types, derivation payload, report; equivalence tests.
3. Import (US2): parsing, names, types, aliases, mapping, restoring, Core validation; corpus and
   hostile tests; round trip.
4. Commands (US3) and docs; findings D1–D3 in the changelog; `pnpm verify`.

## Complexity Tracking

None.
