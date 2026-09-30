# Security Review: Design Tokens Interchange

**Feature**: `005-design-tokens-interchange` | **Scope**: `packages/dtcg/src/**` | **Date**: 2026-09-30 |
**Principles**: constitution VI and XII; FR-D016

- [x] **Imported documents are untrusted data**: at most 1 MiB, strict UTF-8, `JSON.parse` only,
  groups nested at most 64 levels, iterative traversal; nothing is executed (`test/hostile.test.ts`).
- [x] **Prototype pollution**: tokens are indexed in `Map`s; output trees are built with
  `Object.hasOwn` checks; `__proto__`, `constructor`, and `toString` are ordinary names
  (`hostile.test.ts`).
- [x] **Alias abuse**: dangling aliases, 3,000-token chains, and 3,000-token cycles finish and are
  reported; cycles are left out before Core sees them.
- [x] **No approximation, no silent change**: every value that is left out, converted, renamed, or
  restored is reported; the theme is returned only if Core validates it, and import never assigns
  trust (the caller admits the result as it chooses).
- [x] **Boundary lint**: `packages/dtcg/src` imports only `@opentheme/core` and relative modules and
  uses no network API or dynamic code.
- [x] **Randomness**: new identifiers use `crypto.getRandomValues` (128 bits); pass an id for
  deterministic output.
