# Tasks: Specification 1.0.0-draft.6 errata (findings C1 and C4)

**Input**: `specification/CHANGELOG.md` (`1.0.0-draft.4`, open findings C1 and C4). The project
owner approved these resolutions on 2026-10-21:

- **C1**: `OT-META-002` applies to *untrusted* themes at admission: an untrusted theme whose `id`
  starts with `org.opentheme.` is invalid with `OT-META-002` (error) at `/id`. Validation without a
  trust level (`documents.validate`, the reference checker's `validate`) is unchanged. Trust comes
  only from the admission request, never from the document (chapter 06, FR-010).
- **C4**: `OT-A11Y-004` (distinguishable roles) is part of the accessibility conformance report,
  next to `OT-A11Y-003`: in the standard-contrast mode of every supported color scheme, each
  registry `distinguishable` pair whose OKLab ΔE (Euclidean distance of the quantized colors'
  OKLab coordinates) is below `distinguishableThreshold` is `OT-A11Y-004` (warning), located like
  `OT-A11Y-003` (the declaration pointer of pair member `a` in the theme, else `/seeds/<scheme>`),
  `detail` `<a>/<b>`. It never refuses an admission (the gate stays `OT-A11Y-003` only).
  High-contrast and forced-colors modes are excluded and this is recorded explicitly: the
  specification baseline's fixed high-contrast status colors place success/danger at ΔE 0.092.
  Graphite is corrected so its report stays empty.

## Rules for the implementer

- Do NOT redesign the Foundation, rewrite chapters, or weaken any existing requirement. Change only
  the text needed to pin these two rules. If you find a contradiction, stop and report it.
- Core and the reference checker are independent implementations: implement each rule in both
  without sharing code. Both must pass every fixture and the crosscheck must show 0 differences.
- Never change an existing fixture's expected result without saying why in its `description` and
  in the CHANGELOG. Do not touch `packages/react` or `specs/006-react-bindings` (another agent is
  working there).
- One commit per task, real-time dates, messages in the repository's style (`docs(spec): …`,
  `feat(core): …`, `fix(ref): …`, `test(conformance): …`), each ending with
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never rewrite history. Do not push.

## Tasks

- [ ] T001 Spec text: chapter 02 (identifiers) states that `OT-META-002` for the `org.opentheme.`
  prefix applies to untrusted themes at admission, located at `/id`; chapter 11 "Distinguishable
  roles" pins modes, metric, location, detail, warning severity, report membership, and the
  high-contrast exclusion with its reason. Update `specification/registry/1.0/diagnostics.json`
  (fixtures lists) and anything spec-lint requires; regenerate generated files with the
  repository's generator scripts (look at root `package.json`), never by hand.
- [ ] T002 C4 in Core: `packages/core/src/validate/accessibility.ts` `conformanceReport` adds the
  `OT-A11Y-004` check (read the pairs and threshold from the generated registry the same way
  `BASELINE_PAIRS` is read; add an export in `engine/registry.ts` if needed). Unit tests.
- [ ] T003 C4 in the reference checker: `tools/reference-checker/src/validate/a11y.ts`
  `accessibilityReport` and wherever the resolver includes the report
  (`tools/reference-checker/src/resolve/index.ts` near `OT-A11Y-003`), implemented independently.
- [ ] T004 Graphite: measure ΔE for every distinguishable pair in all four modes for the baseline,
  Aurora, and Graphite (write a small script in your scratch space, not in the repo). Add to
  `specification/themes/reference/org.opentheme.graphite.opentheme.json` the smallest change that
  brings `color.status.warning.background` to ΔE ≥ 0.10 from `color.action.primary.background` in
  light standard while every contrast pair still passes in every mode (prefer a context overlay
  `when: { colorScheme: "light", contrast: "standard" }` if the format allows it; otherwise the
  smallest token change). Bump Graphite's `version` to `1.0.1` because its content changes, and
  update every reference to Graphite's version and every fixture or golden hash derived from it
  (regenerate with the repository's scripts). Aurora and the baseline must not change.
- [ ] T005 Fixtures for C4: in `conformance/fixtures/accessibility/`, one theme with a
  distinguishable shortfall in light standard (`OT-A11Y-004` expected with pointer and detail), one
  whose only shortfall is in high contrast (no `OT-A11Y-004`), and one showing an untrusted theme
  with only `OT-A11Y-004` is still admitted under the enforced gate (if the fixture kinds allow it).
- [ ] T006 C1 in Core: in admission (`packages/core/src/registry/reevaluate.ts` `evaluateTheme` or
  `registry.ts`), an untrusted theme whose id starts with `org.opentheme.` gets `OT-META-002` at
  `/id` and validity `invalid`. Unit tests in `packages/core/test/unit/admission/`.
- [ ] T007 C1 in the reference checker: the resolver's handling of supplied themes
  (`tools/reference-checker/src/resolve/select.ts` and related) treats such untrusted documents as
  invalid with the same diagnostic.
- [ ] T008 C1 fixtures: review `conformance/fixtures/resolution/us2/baseline-impostor.json`,
  `identity-collision*.json`, `identity-claim-no-trust.json`, `base-shadow-untrusted-first.json`,
  `us8/ai-untrusted.json`, `us7/*` and every other fixture with an untrusted `org.opentheme.*`
  document. Where the expected result changes (for example `identity-claim-no-trust`, where the
  impostor no longer applies), update the expected result and description to state the new rule;
  where a fixture's purpose was the untrusted-official-id case and is now moot, change the impostor
  id to a non-reserved id only if that keeps the original rule (`R-SEC-001`) tested, and keep a
  separate new fixture for C1 (`OT-META-002` at `/id`, falling back). List every changed fixture in
  your report.
- [ ] T009 CLI and docs: check `packages/cli` (untrusted is the default there) and the READMEs for
  examples that use an `org.opentheme.*` id with an untrusted theme; fix them.
- [ ] T010 CHANGELOG: add `## 1.0.0-draft.6 (2026-10-21)` above draft.5 recording C1 and C4 as
  resolved (with the high-contrast exclusion and the Graphite 1.0.1 change), every fixture whose
  expected result changed and why, and a new open finding **C10**: chapter 02 also reserves `uid.`
  but no rule says a `uid.` id must be followed by exactly 26 base32 characters; not enforced,
  decision needed. Bump the specification version string `1.0.0-draft.5` → `1.0.0-draft.6`
  wherever the repository records the current draft (grep for it; leave history entries alone).
- [ ] T011 Run `pnpm build`, `pnpm verify:correctness`, the conformance runner for both
  implementations, and the crosscheck; all must pass with 0 differences. Mark tasks `[X]`.
