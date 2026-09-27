# Quickstart: Validating the Theme Specification and Theme Foundation

This guide explains how to check that the feature's deliverables (FR-099) meet the specification
once they are built. It lists commands and expected outcomes only; it contains no implementation.
Paths refer to the repository layout in [plan.md](./plan.md). Fixture identifiers are
illustrative: the authoritative list is `conformance/fixtures/` and `rules.json`.

## Prerequisites

- Node.js 24 LTS (CI also runs Node.js 26) and pnpm 10 or later.
- Python 3.13, standard library only, for the kernel cross-check.
- No network access is needed after installation (NFR-004).

## 1. Set up

```bash
pnpm install
pnpm build            # reference checker, generated types, conformance runner
```

**Expected**: The build succeeds with no warnings, and `pnpm exec ot-ref --help` lists the commands
in [contracts/conformance.md](./contracts/conformance.md).

## 2. Check the specification artifacts for consistency

```bash
pnpm spec:check
```

This runs:

- meta-validation of every schema (draft 2020-12);
- schema validation of every registry;
- the prose, schema, registry, and fixture consistency check;
- rule-to-fixture and requirement-to-rule traceability (NFR-010);
- markdownlint on `specification/spec/`;
- the domain-term scan (SC-012, automated part);
- the forbidden-capability scan, which confirms that no field can hold code, styling text,
  selectors, addresses, conditions, or data access.

**Expected**: Zero findings. Every rule has a fixture, every fixture names a rule, and every
requirement FR-001 to FR-099 is traced.

## 3. Run the conformance suite against the reference checker

```bash
pnpm conformance      # runs conformance/runner against `ot-ref serve-conformance`
```

**Expected**: 100% pass, no "unsupported", and a JUnit report in `conformance/out/`. This covers:

| Outcome | Covers |
|---|---|
| Every malicious fixture rejected with its expected code and location; no partial application | US2, SC-003 |
| Every invalid fixture reports every error, each with a code, location, and hint | US2, SC-005 (automated part) |
| Every resolution example produces its single expected result byte for byte | US3, US4, SC-009 (automated part) |
| Canonical form and integrity unchanged after export and re-import, extensions included | US7, SC-011 |
| Earlier 1.x fixtures still valid, resolving equivalently; migrations from the previous major match | US6, SC-013 |
| Kernel golden vectors match bit for bit | NFR-001 |

This feature delivers the conformance protocol, fixtures, runner, and reference checker that make
SC-004 measurable. Full SC-004 (agreement with a second, independently developed validator) is a
cross-feature release gate verified when the production core passes the same suite:

```bash
pnpm conformance --impl "<command that speaks the runner protocol>"
```

## 4. Run the accessibility sweeps

```bash
pnpm sweeps
```

**Expected**:

- **SC-014 (accents)**: 1,000 sRGB accents × every reference theme × every mode. Every
  accent-related token is derived, every derived text-on-accent pair meets AA, and every other
  declared pair either meets AA or the accent is rejected with `OT-A11Y-007`. Nothing is ever
  applied below AA.
- **SC-015 (seeds)**: 1,000 or more seed-only fixtures whose seed pairs meet AA. Each resolves
  completely in every declared mode, every default-derived pair meets AA, and every pair in
  high-contrast mode meets 7:1 (4.5:1 for large text) and 3:1 for non-text.
- **SC-006**: the baseline theme and every reference theme pass the full accessibility report:
  pairs, forced-colors mapping, reduced-motion values, and target sizes at every density.

## 5. Cross-check the numeric kernels

```bash
pnpm kernels:crosscheck
```

**Expected**: The Python implementation of the kernels produces exactly the golden-vector outputs
(compared as bit patterns). Any difference fails.

## 6. Walk through the user stories by hand

Each step uses the reference checker's machine-readable output (`--json`).

1. **US1 / SC-001 / SC-002: prebuilt themes, zero authored values.**

   ```bash
   ot-ref validate specification/themes/reference/<theme>.opentheme.json \
     --host specification/hosts/<host>.opentheme-host.json --json
   ```

   Run this for each reference theme with each reference host. **Expected**: valid, zero errors,
   and 100% coverage of standard tokens and contracts. Host extension contracts resolve from their
   defaults.

2. **US2: an unsafe theme is never applied.**

   ```bash
   pnpm conformance --filter "malicious/**" --verbose
   ```

   **Expected**: each fixture's theme is invalid, and its exact diagnostic list is shown. The
   paired `resolution/fb-*` fixtures select such a theme. **Expected**: the result falls back to
   the previous or developer-default theme, with a `RES` diagnostic, and no value from the
   rejected theme appears.

3. **US3: mode selection.** Resolve the input from
   [contracts/resolution.md](./contracts/resolution.md), changing `contrast` to `high`.
   **Expected**: the same theme with high-contrast values and no theme switch (FR-025). Requesting
   a color scheme the theme does not support uses its default scheme, with `OT-CTX-101`.

4. **US4: customization.** Set `std.text-size` to 3 with a platform scale of 2, using the
   standard point from `registries.md` (in-app range 1 to 2, effective range 1 to 3). **Expected**:
   the in-app factor is clamped to 2 with `OT-CUS-101`, reported as status `clamped` with the value
   used (2), and the effective scale is max(2, clamp(2 × 2, 1, 3)) = 3. The input preference of 3
   is not modified, because resolution never writes preferences. With a platform scale of 4
   instead, the effective scale is 4: the platform's request is never reduced. Setting an enum
   point to a value the theme no longer allows gives status `fell-back`, uses the default, and
   reports `OT-CUS-102`.

5. **US5: host extension contract.** Validate a theme that styles
   `com.example.notes/timeline` against the media-style host. **Expected**: valid, and the
   styling is ignored with `OT-CMP-001`, not reported as an error.

6. **US6: versioning.**

   ```bash
   ot-ref compare <old> <new>
   ```

   **Expected**: removing a customization point is classified as breaking. Running
   `ot-ref migrate` on the previous-major fixture produces the expected document and a
   `OT-VER-003` diagnostic.

7. **US7: create and share.** Canonicalize a user-provenance theme, export-check it, and
   re-import it. **Expected**: the same canonical bytes and integrity. A theme without an author
   or license fails `export-check` with `OT-META-008`.

8. **US8: AI generation.** See section 8. The machine-readable entry point is
   `specification/llms.txt`, which links the schemas, registries, and examples only.

## 7. Check the performance budgets

```bash
pnpm bench
```

**Expected** (CI x86-64 proxy, research R22):

| Case | Median |
|---|---|
| Validate and resolve a typical theme (1,000 tokens) | 25 ms or less |
| Validate and resolve a theme at the resource limits | 250 ms or less |
| Reject a 10 MiB document before parsing | 5 ms or less |
| Re-resolve after a context change | 4 ms or less |

Before release, also run `pnpm bench:browser` on the named mid-range Android reference device
and confirm SC-010 directly: 100 ms for a typical theme and 1 s at the limits.

## 8. Run the manual evaluations (before 1.0.0)

These evaluations are not part of CI. Their protocols and scoring scripts are in `evaluations/`.

| Evaluation | Pass criterion |
|---|---|
| `evaluations/diagnostic-review` | SC-005: reviewers find the correct fix from diagnostics alone for 90% or more of fixtures |
| `evaluations/authoring-timing` | SC-007: 80% or more of five or more newcomers produce a seed-only theme in 15 minutes, and light, dark, and high contrast in 30 minutes |
| `evaluations/ai-generation` | SC-008: 90% or more valid on the first attempt and 99% or more after one diagnostics round, over 100 or more attempts across two or more models |
| `evaluations/resolution-prediction` | SC-009: reviewers predict 95% or more of resolution examples |
| `evaluations/vocabulary-review` | SC-012: an independent reviewer finds zero domain terms and zero behavior-capable fields |

## 9. Release gates

`pnpm release:check` must pass before 1.0.0. It fails on any of the following:

- a remaining `LicenseRef-OpenTheme-Pending` license (constitution TODO(LICENSE));
- a missing maintainer list (TODO(MAINTAINERS));
- any failing check above;
- any evaluation from section 8 without a recorded passing result.
