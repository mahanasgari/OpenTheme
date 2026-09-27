# Protocol: authoring timing (SC-007)

Measure how quickly newcomers can author themes from the examples and schemas.

Pass bar: ≥ 80% of five or more participants produce:

- a seed-only theme in ≤ 15 minutes;
- a light, dark, and high-contrast theme in ≤ 30 minutes.

Score with:

```bash
pnpm exec tsx evaluations/authoring-timing/score.ts --results timing.json
```
