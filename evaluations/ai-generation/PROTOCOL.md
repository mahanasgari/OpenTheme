# Protocol: AI theme generation (SC-008)

**Status**: Manual evaluation. Not part of CI. Not a package dependency (Principle VII).

## Goal

Measure whether models can produce valid OpenTheme themes from the machine-readable
specification alone (`specification/llms.txt` and its linked files).

## Pass criteria

- At least 100 attempts across at least two model providers.
- First-attempt validity ≥ 90%.
- Validity after one correction round (diagnostics JSON only) ≥ 99%.

## Runner

`evaluations/ai-generation/run.ts` is provider-agnostic:

```bash
pnpm exec tsx evaluations/ai-generation/run.ts \
  --command "my-model-cli" \
  --attempts 50 \
  --label provider-a
```

For each attempt:

1. Build a prompt that includes only `llms.txt` and the paths it links (no prose chapters
   beyond what `llms.txt` cites).
2. Run `--command` once with the prompt on stdin; capture stdout as candidate JSON.
3. Validate with `ot-ref validate --json`.
4. If invalid, run one correction prompt that contains only the diagnostics JSON and the
   previous document; re-validate.
5. Record outcomes under `evaluations/ai-generation/results/`.

Aggregate labels from multiple providers before scoring.
