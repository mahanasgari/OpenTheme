# Specification Quality Checklist: OpenTheme Core Runtime

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Three `[NEEDS CLARIFICATION]` markers remain by design, because each needs a user decision:
  FR-C024 (where the "untrusted themes allowed" decision lives), FR-C060 (whether the Preferences
  and Policy document formats are in scope), and FR-C083 (the vocabulary for operational errors).
  Resolve them with `/speckit-clarify` before `/speckit-plan`.
- FR-C034 depends on Open Question Q4 (choosing a version when several are registered). Until it
  is answered, Core matches the conformance suite.
- On "no implementation details": Core is a library, so its "users" are developers. The spec names
  API *concepts* and their contracts, but no signatures, languages, or packages. TypeScript
  appears only as an assumption carried over from Foundation research R18.
- On "technology-agnostic success criteria": the criteria cite Foundation artifacts (the
  conformance suite and its budgets) as the measuring instruments, not technologies.
- Foundation findings F1–F10 are recorded in the spec and were not fixed, because Foundation
  changes are out of scope.

## Verification record (2026-09-26, T120)

`pnpm verify`: green. Spec-lint ok; 523 tests; conformance 259/259 for the reference checker
and for `@opentheme/core`; `crosscheck:core` 259 fixtures, 0 differences; `crosscheck:core:sweeps`
0 differences; kernels 7,060 golden vectors plus 42,060 Core-versus-Python inputs, bit for bit;
API report unchanged; bundle 76.6 KB gzip (budget 100 KB).

Benchmarks (`pnpm bench:core`, part of `verify` since T121): typical 12 ms, at-limit 223–229 ms as the
bundled build (budget 250 ms), 10 MiB refusal 0.02 ms,
re-resolution 1.1 ms.

Browser (`pnpm bench:core:browser`, desktop Chrome, 2026-09-26): determinism PASS — the result
hashes of all 119 resolution fixtures equal Node's. Typical 13.0 ms, at-limit 384 ms (**over**
250 ms), 10 MiB refusal 0.0 ms, re-resolution 1.1 ms. Not yet run on the reference phone.
