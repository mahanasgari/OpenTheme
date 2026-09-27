# 06. Contexts and Modes

**Status**: Normative. Research R11. Registry: `context-dimensions.json`.

## Dimensions (FR-024)

The five standard dimensions are `colorScheme`, `contrast`, `motion`, `density`, and
`sizeClass`. Closed values and size-class thresholds are those in the context-dimensions
registry. Overlay precedence among equal specificity uses priority:
contrast > colorScheme > density > sizeClass > motion (FR-056).

## Color schemes (FR-025, FR-026)

A theme MUST declare a non-empty `colorSchemes.supported` set and a `default` that is one of
them. Official and reference themes MUST support both `light` and `dark`. Variants MAY be
declared with `{ fallback: "light" | "dark" }` (FB-003). A variant without its own seed block
uses the fallback scheme's seeds. When the platform prefers a scheme outside
`allowedColorSchemes` ∩ supported, the theme default is used with `OT-CTX-101`.

Every valid theme MUST have a high-contrast mode for each supported scheme: author
`contrast: high` overlays where present, otherwise seed-derived high-contrast defaults. Requesting
high contrast MUST NOT move the user to another theme (FB-004).

## Mode selection (FR-052, FR-053)

Effective context is computed as follows:

1. **Color scheme** (FR-053): user's `std.color-scheme` (if declared and permitted), then the
   platform preference, then the policy/theme default, limited to `allowedColorSchemes` ∩
   supported.
2. **Contrast**: `high` if the platform or a permitted user preference requests it. A user or
   developer choice MUST NOT remove platform-requested high contrast (FR-052, FB-004).
3. **Motion**: `reduced` if the platform or user requests it; it MUST NOT be restored while the
   platform asks for reduced motion.
4. **Density**: from a permitted `std.density` preference, else `standard`.
5. **Size class**: from the environment (FR-038).

A preference for a point that is undeclared by the theme or absent from `permittedPoints` is
skipped with `OT-CUS-103` and does not affect context.

## Overlays

`contexts` is an ordered array (≤ 64). Each overlay has a non-empty `when` map. Duplicate `when`
maps are errors (`OT-CTX-002`). Overlays MUST NOT introduce undeclared tokens (`OT-CTX-004`).

Overlays apply in ascending specificity (number of conditions). Ties use the dimension priority
above. Among color-typed values in high contrast, only high-contrast overlays and high-contrast
defaults contribute (research R11). Variant schemes also match overlays written for their
fallback scheme.
