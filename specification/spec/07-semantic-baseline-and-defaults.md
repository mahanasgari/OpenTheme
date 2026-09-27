# 07. Semantic Baseline and Defaults

**Status**: Normative. Research R10. Registry: `semantic-baseline.json` is authoritative.

## Seeds

Reserved tokens: `seed.background`, `seed.foreground`, `seed.accent` (per scheme), and
`seed.font-family`. Seeds are opaque. A missing seed for a supported scheme is `OT-TOK-010`.

## Baseline groups (FR-015)

The baseline defines tokens in groups `color`, `font`, `text`, `space`, `size`, `radius`,
`border`, `elevation`, `opacity`, `motion`, `focus`, `breakpoint`, and `layout`, including
`radius.factor` and `size.target.min`, plus typography roles (body, heading 1–4, label, caption,
monospace).

Each color token has a specification `default`, a `highContrastDefault` (seeds and high-contrast
values only; late-bound), and a `forcedColor` role (FR-054). Motion tokens have reduced-motion
defaults of 0 ms (FR-028).

## Proof obligations

(a) Seed-only themes whose seed pairs meet AA resolve completely with AA pairs (SC-015).
(b) High-contrast modes meet FR-027 enhanced thresholds. Failures are formula defects, not
seed-validity relaxations.
