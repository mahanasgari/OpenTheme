# Diagnostic review protocol (SC-005)

Manual evaluation: reviewers see only a fixture and its diagnostics, propose a fix, and score
whether the diagnostics were sufficient to repair the theme without reading the specification
narrative.

## Setup

1. Sample at least 20 fixtures from `conformance/fixtures/invalid/**` and
   `conformance/fixtures/malicious/**`.
2. For each sample, give the reviewer:
   - the theme document (or generated input);
   - the ordered diagnostics (`code`, `location`, `message`, `hint`);
   - no expected-fix answer key.

## Scoring

A case **passes** when the reviewer states a concrete edit that would clear the diagnostics and
that edit matches the fixture's intended defect (or an equally valid repair).

Score = passed / total. **Threshold**: ≥ 90%.

## Recording

Use `score.ts` to tally results:

```bash
pnpm exec tsx evaluations/diagnostic-review/score.ts results.json
```

`results.json` is an array of `{ "id": "<fixture id>", "pass": true | false }`.

This evaluation is manual and is **not** part of CI.
