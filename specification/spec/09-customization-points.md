# 09. Customization Points

**Status**: Normative. Declaration and FR-044 enforcement (foundational). Policy narrowing,
carry-over, and removed points: US4.

## Fields

Point fields and constraints follow data-model §9. Targets are 1–16 token paths or one context
dimension (`colorScheme`, `contrast`, `motion`, `density`). The documented default is the point's
`default` or, if absent, the theme's own target value in the active context (for `std.accent`, the
scheme's accent seed).

## Standard points (FR-041)

Themes opt in by id. The registry supplies label, type, and widest constraints; themes MAY narrow
only. Reference themes declare all seven standard points.

## Consistency (FR-042)

Documented defaults MUST satisfy constraints in every context. `(max − min) / step` MUST be an
integer. Text-size `min` MUST be ≥ 1. Violations → `OT-CUS-001` … `OT-CUS-006`.

## Enforcement (FR-044)

For a user value against effective constraints:

1. Continuous range: clamp to nearest boundary; snap to nearest step (ties → lower).
2. Color range: gamut-map into sRGB and force alpha to 1.
3. Discrete enum/presets: fall back to the documented default.
4. Emit `OT-CUS-101` (clamped/snapped) or `OT-CUS-102` (fell back). Never modify the stored
   preference.

Same-layer rule: when several points target one token, the last-declared point wins.

## Policy narrowing (FR-043)

`policy.permittedPoints` is the intersection with theme-declared points. For each permitted id,
policy MAY supply narrower constraints and/or a replacement `default`. Narrowing MUST NOT widen
ranges or enums beyond the theme (and registry) constraints. If narrowing excludes the documented
default and no replacement default is given, resolution reports `OT-CUS-001` at `input` and rejects
the preference.

## Presentation information (FR-045)

Resolved themes expose preference status per point (`effective`, `clamped`, `fell-back`, `skipped`,
`rejected`) without mutating the stored preference values. Hosts use this for UI presentation
(badges, clamp notices) only.

## Carry-over (FR-041)

Preferences are keyed by point id. When the user switches themes, values for points that both the
previous and the new theme declare (and that policy still permits) apply unchanged. Themes that
omit a point simply skip that preference (`OT-CUS-103`).

## Removed-point skipping (FR-085, FB-006)

When the `previous` version of the **same** theme id declared a point that the selected version no
longer declares, a stored preference for that id is skipped with `OT-CUS-104` (informational). The
preference is not deleted.

## Resolution-time statuses (FR-044, FB-005 to FB-007)

For each stored preference, resolution reports `{ status, value }` under `preferences`:

- `skipped`: the point is not declared, not permitted, or every target is protected by policy.
  For a protected target, `value` is the stored value; otherwise no `value` is reported. Undeclared
  or unpermitted points produce `OT-CUS-103` (or
  `OT-CUS-104` for a point removed since `previous`); a protected target produces no diagnostic.
- `rejected`: the policy's narrowing excluded the documented default without a replacement
  (`OT-CUS-001` at the policy), the value would undo a platform accessibility request (standard
  contrast while the platform requests high contrast, or standard motion while it requests reduced
  motion; no diagnostic), or the accessibility floor rejected it (`OT-A11Y-007`). `value` is the
  stored value, and the point's documented default applies.
- `clamped` or `fell-back`: per the enforcement rules above; `value` is the value used.
- `effective`: `value` is the value used.

A color value on a continuous color point is gamut-mapped to sRGB, quantized to 8-bit channels,
and given alpha 1; it is `clamped` whenever that result differs from the stored value. The
color-scheme point offers the theme's supported schemes, variants included.
