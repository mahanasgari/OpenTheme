# 14. Versioning and Migration

**Status**: Normative (US6).

## Specification SemVer (FR-079)

The Theme Specification uses SemVer for releases. Draft labels (`-draft.N`) mark pre-release
documents. Implementations target `opentheme` as MAJOR.MINOR.

## Targeting (FR-080)

A theme's `opentheme` field is MAJOR.MINOR. Implementations that implement major `M` MUST accept
`M.0` through `M.N` for every published minor `N` of that major. Newer minors than the
implementation supports → `OT-VER-002`. Unsupported majors → `OT-VER-001`.

Frozen conformance expects (SC-013) MUST NOT change without a CHANGELOG entry marked "bug fix".

## Migration manifests (FR-081, FR-082)

Cross-major upgrades use a migration manifest `{ from, to, operations }`. Operations are
`rename-path`, `move-member`, `map-value`, and `drop-member { lossy: true }`. Lossy drops emit
`OT-VER-004`. Under the test profile `simulated-previous-major`, themes of the previous major are
accepted only through migration and emit `OT-VER-003`.

## Deprecation (FR-023, FR-083)

Tokens marked `$deprecated` (or registry elements with a non-null `deprecated` field) emit
`OT-VER-005` with the replacement path in params. Deprecations remain valid through the announced
window.

## Theme-version classification (FR-084)

Comparing two theme versions yields `compatible` or `breaking`. Breaking changes include removing
a customization point, changing a point's type or target, narrowing constraints so prior values no
longer fit, removing a supported color scheme, or removing a `compatibility.extensions` namespace.
Value changes, added points, and widened ranges are compatible. Each reason is
`{ kind, detail, pointer }`: `point-removed`, `point-type-changed`, `point-target-changed`, and
`constraints-narrowed` (detail: the point id; pointer `/customization/points`), `scheme-removed`
(`/colorSchemes/supported`), and `extension-removed` (`/compatibility/extensions`).

## Contract versioning (FR-086)

Contract pins apply when the major matches and the theme's minor is not newer than the declared
contract minor; otherwise `OT-CMP-002`.
