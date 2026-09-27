# Protocol: resolution prediction (SC-009)

Reviewers predict resolved token values from fixtures without running the resolver.

Pass bar: ≥ 95% of predictions match the fixture `expect.resolved` members.

Score with:

```bash
pnpm exec tsx evaluations/resolution-prediction/score.ts --answers answers.json
```
