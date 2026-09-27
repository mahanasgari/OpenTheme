# 10. Inheritance and Resolution

**Status**: Normative. Foundational resolution pipeline. Inheritance `extends`: US2. Locks: US1.
User layer + accessibility-floor re-run: US4. Platform post-process: US3.

## Inheritance (`extends`) (FR-046–FR-048)

A theme MAY declare `extends: { id, version }` where `version` is an exact semantic version or a
caret range `^M.m.p`. The implementation looks up a base among supplied bases (or the host theme
set), checks that the base is valid and version-compatible (`OT-INH-001` missing, `OT-INH-002`
invalid base, `OT-INH-003` version outside range), rejects cycles (`OT-INH-004`), and limits chain
depth to 4 (`OT-INH-005`). Locations for inheritance failures use `base:<id>@<version>`.

**Merge** is base-first: the child overrides token values; context overlays merge per identical
`when` key; component styling merges; a redefined customization point keeps its id and type while
constraints may be narrowed or replaced. Trust of a resolved theme is the lowest trust level in
its inheritance chain (FR-048): a child of an untrusted base is untrusted.

Flattening of inheritance for interchange is specified in chapter 15 (FR-049): merge base-first,
drop `extends`, and append `provenance.lineage` oldest first.

## Precedence layers (FR-050)

1. Specification defaults (high-contrast defaults when contrast is high) and contract defaults.
2. Theme values and overlays.
3. Permitted user preferences (customization points).
4. Developer policy (locks, protected paths, floors) — US1/US2/US4.
5. Platform accessibility preferences — US3.

## Developer policy: available themes, default theme, and locks

The developer policy is layer 4 of FR-050. It is supplied with the resolution input, not authored
inside a theme document.

- **`availableThemes`**: the closed set of theme ids the host may apply. Selection outside the set
  is treated as missing and enters the fallback chain.
- **`defaultTheme`**: the developer-default theme used after `previous` fails (FB-001). When it is
  also unavailable or invalid, resolution continues to the specification baseline.
- **`locks`**: a map from a semantic token path, or a contract property path of the form
  `components.<contract id>.parts.<part>.<property>`, to a literal value (FR-051, FR-055, FR-070).
  Locked values are fixed inputs to evaluation: dependents derived from a locked token see the
  locked literal. A mistyped lock (wrong type for the target) yields `OT-TOK-004` at
  `input` `/policy/locks/<path>` and the lock is ignored.
- Locks do not rewrite unrelated tokens. Locking `color.action.primary.background` recomputes
  `background-hover`, `background-pressed`, and `color.text.on-action` that derive from it, while
  leaving `color.surface.base` equal to the unlocked result.

## Selection, trust, and fallback (FR-068, FB-001, FB-010)

Selection order is: selected → previous → developer default → specification baseline. An
untrusted entry MUST NOT replace or shadow a trusted entry with the same id; it is kept distinct
and flagged `OT-SEC-001`. When the selected theme is invalid, its validation diagnostics are
included in the resolution output and nothing from it is applied (`OT-RES-001`–`OT-RES-004`,
FR-065).

**Unversioned selection** (`R-RES-005`). When a selection, `previous`, or `defaultTheme` names an
id without a version and several versions of that id are candidates, the candidate with the
highest SemVer 2.0.0 precedence is chosen, whatever the order of `themes` entries. Build metadata
does not affect precedence; candidates of equal precedence are ordered by their version strings in
code-point order, and the greatest is chosen. Candidates are the entries that remain after the
trust and identity rules of chapter 12 (untrusted entries that collide with a trusted id, and
`(id, version)` pairs with conflicting integrity, are not candidates). If the chosen version is
invalid or unsupported, that fallback step fails as a whole and the chain continues (FB-001);
older versions of the same id are never tried in its place.

## Resolution stages

1. **Select** theme (fallback: previous → developer default → specification baseline).
2. **Context** — compute effective dimensions (including user dimension preferences).
3. **Declare** — merge layers 1–2 into a token graph, then apply layer-3 preferences and layer-4
   locks.
4. **Evaluate** — Kahn's algorithm; ties by canonical path; effort budget enforced.
5. **Post-process** — text scale, density target-size floor, reduced motion, RTL, forced colors.
6. **Quantize** — sRGB 8-bit and alpha.
7. **Check** — accessibility report; under `wcag22-aa`, failing pairs that depend on user values
   reject those preferences (`OT-A11Y-007`) and stages 3–7 re-run exactly once with documented
   defaults for the rejected points. Under `relaxed`, failures remain warnings.

## User layer (layer 3)

The effective customization set is theme-declared points ∩ `permittedPoints`. Token-target points
rewrite declaration values before evaluation (`std.accent` → `seed.accent`, `std.corner-roundness`
→ `radius.factor`). Dimension points are applied in the context stage. Protected paths in policy
are immune to user values. User-dependent derivation operands outside their domain are clamped with
`OT-DRV-102`.

## Resolved values (FR-057)

Every value in `tokens` and in `components` is fully concrete: no alias, derivation, or unquantized
color remains. Values are encoded by type:

| Type | Encoding |
|---|---|
| `color` | `{ "srgb8": [r, g, b], "alpha": a }` (8-bit channels, alpha in multiples of 0.001), or `{ "system": <role> }` under forced colors |
| `dimension` | `{ "value": n, "unit": "px" }` |
| `duration` | `{ "value": n, "unit": "ms" }` |
| `number`, `opacity`, `fontWeight` | `{ "number": n }` |
| `fontFamily` | `{ "families": <the fallback list, or the script-keyed map> }` |
| `cubicBezier` | `[x1, y1, x2, y2]` |
| `strokeStyle`, `density` | the string value |
| `typography`, `border`, `shadow` | an object with the composite's members, each resolved |

Inside a composite, an alias member takes the referenced token's resolved value, except that a
number is written bare (for example `"lineHeight": 1.5`); a literal color member is quantized; a
literal font-family list is written as `{ "families": [...] }`; other literal members keep their
literal form. Text scaling applies to composite `fontSize` members and dimension `lineHeight`
members as it does to tokens.

The resolved `context` reports the effective `colorScheme`, `contrast`, `motion`, `density`,
`sizeClass`, `textScale`, `forcedColors`, `direction`, and `locale`, plus `seedScheme`: the
standard scheme whose seeds apply (a color-scheme variant reports its fallback scheme).
