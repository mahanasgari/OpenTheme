# 03. Tokens

**Status**: Normative.

## Types (FR-012, FR-013)

The closed type set is: `color`, `dimension`, `fontFamily`, `fontWeight`, `number`, `opacity`,
`duration`, `cubicBezier`, `strokeStyle`, `border`, `shadow`, `typography`, `density`.

Literal grammars are those in the schema defs and data-model §4. Colors use sRGB or OKLCH with
optional alpha (FR-021). Font families are ordered fallback lists ending in a generic family,
optionally per script (FR-022).

## Paths and groups (FR-019)

The first path segment matches `[a-z][a-z0-9-]*`; every later segment matches `[a-z0-9][a-z0-9-]*`
(so `space.4` is a valid path). Segments are at most 64 characters and paths at most 256 in total.
Violations → `OT-TOK-001`.
Reserved groups: `seed`, `primitive`, and the baseline semantic groups (`color`, `font`, `text`,
`space`, `size`, `radius`, `border`, `elevation`, `opacity`, `motion`, `focus`, `breakpoint`,
`layout`).

## Primitive versus semantic (FR-014)

Primitive tokens are theme-internal and MUST NOT appear in resolved host-facing output. Semantic
tokens are named by role and consumed by hosts.

## Aliases and derivations (FR-017)

`$value` is a literal or `{path}` alias. `$derive` is exclusive with `$value`. Aliases and
derivations form one reference graph. Cycles are errors (`OT-REF-003`). Reference chain depth
MUST NOT exceed 16 (`OT-REF-004`).

## Deprecation (FR-023)

Tokens MAY be marked `$deprecated` with an optional replacement path. Use produces `OT-VER-005`.

## Logical versus physical (FR-077)

Directional values are logical by default and mirror in RTL. A composite member MAY set
`"physical": true` to opt out.
