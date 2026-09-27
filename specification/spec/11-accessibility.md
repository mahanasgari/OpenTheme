# 11. Accessibility

**Status**: Normative. Foundational contrast and seeds. Platform post-process: US3. Target size /
in-app text factor details continue in US4.

## Contrast (FR-072, FR-073, research R8)

Contrast uses the WCAG 2.2 relative luminance algorithm on quantized sRGB. Translucent colors are
composited onto each background first. Declared pairs below threshold are warnings (`OT-A11Y-003`)
except seed pairs (`OT-A11Y-001`, error) and high-contrast mode failures (`OT-A11Y-002`, error).

## Accessibility conformance report (FR-064)

Accessibility conformance is reported separately from validity, for a valid theme after
inheritance and with the active host declaration, if any. A mode is a supported color scheme
with `standard` or `high` contrast, standard motion, standard density, the `medium` size class,
no preferences, and no policy. In each mode, every registry pair except disabled pairs is
measured against the mode's thresholds (standard: 4.5:1 text, 3:1 large text and non-text; high:
see below).

A shortfall in a high-contrast mode, and a seed-pair shortfall, are validity errors
(`OT-A11Y-002`, `OT-A11Y-001`), so a valid theme has none. Every other shortfall is `OT-A11Y-003`
(warning). It is located at the theme member that declares the foreground token, or else at
`/seeds/<scheme>`, with `detail` set to `<foreground>/<background>`. A valid theme with
shortfalls is valid but non-conformant; whether it may be used is decided by developer policy.

## High contrast (FR-027)

Text pairs MUST meet 7:1 (4.5:1 large text); non-text pairs MUST meet 3:1. Platform or user
requests for high contrast always activate the theme's high-contrast mode; they never switch the
user to another theme (FB-004).

## Forced colors (FR-054)

When `platform.forcedColors` is true, every standard semantic color token (and every contract
color property) resolves to `{ "system": <role> }` using the mapping in `forced-colors.json`
(canvas, canvas-text, link-text, button-face, button-text, highlight, highlight-text, gray-text,
button-border). Theme sRGB values are not used while forced colors are active, and the
accessibility report lists no pairs.

## Reduced motion (FR-028)

When effective motion is `reduced`, every `motion.duration.*` token takes its
`reducedMotionDefault` (specification default 0 ms) so non-essential movement is removed. A user
preference of `std.motion` "standard" MUST NOT override a platform reduced-motion request.

## Platform text scaling (FR-020)

Font sizes and dimension line heights scale by the effective text scale:

`effective = max(platform, clamp(platform × in-app, effectiveRange.min, effectiveRange.max))`

where `in-app` comes from `std.text-size` (default 1) and `effectiveRange` is the text-size point's
range (registry default `{ min: 1, max: 3 }`), optionally narrowed by policy. Unitless line-height
numbers are not scaled. Platform scale alone always wins when it exceeds the clamped product. The
effective scale is rounded to 12 decimal places (half to even) before use.

## Target size (FR-075)

At every density, interactive control sizes (`size.target.min`, `size.control.height.*`) MUST
resolve to at least 24 CSS px. Lower theme values are raised to 24 px with `OT-A11Y-006`
(warning), located at the token's path under `/tokens` in the theme
document.

## Text spacing (FR-076)

Sizes of parts that contain text act as minimums that grow with their content and with text
spacing. Hosts MUST NOT clip or truncate such content solely because spacing increased.

## Direction and logical values (FR-077)

Directional token paths ending in `start`/`end` (or `inline-start`/`inline-end`) mirror under
`direction: rtl`. Tokens marked physical (`$extensions["org.opentheme.physical"]` or
`physical: true`) MUST NOT mirror.

## Distinguishable roles (FR-073)

Baseline distinguishable pairs use OKLab ΔE with threshold from the registry (default 0.10).
Failures are warnings (`OT-A11Y-004`).

## Literal ranges

A token literal is outside its range (`OT-TOK-005`) only for the bounds of its type: color alpha
and sRGB components in `[0, 1]`, opacity in `[0, 1]`, font weight in `[1, 1000]`, duration in
`[0, 1000]` ms, and cubic Bézier x values in `[0, 1]`. The registry `range` of a baseline role
bounds derivation outputs (`OT-DRV-101`) and is enforced at resolution (for example the 24 px
target-size floor); it does not make a literal invalid.
