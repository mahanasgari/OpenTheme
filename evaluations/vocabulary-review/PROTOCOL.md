# Protocol: vocabulary review (SC-012)

Manual review that the specification vocabulary stays domain-agnostic.

1. Run `pnpm spec:check` (includes the automated domain-term scan).
2. Two independent reviewers skim chapters, registries, and schemas for product- or
   brand-specific language not on the allowlist (`specification/hosts`,
   `specification/examples`).
3. Record the outcome in `evaluations/results.json`.
