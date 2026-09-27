# Data Model: Theme Specification and Theme Foundation

**Feature**: `001-theme-specification-foundation` | **Date**: 2026-09-25 | **Plan**: [plan.md](./plan.md)

This model describes the documents and registries that the Theme Specification defines, their
fields and relationships, the validation rules that apply to each, and the states a document or
preference passes through. Wire formats and examples are in [contracts/](./contracts/); decisions
are justified in [research.md](./research.md). "R#" refers to research decisions and "FR-#" to the
feature specification.

## Overview

```text
Theme Document ──extends──▶ Theme Document (base, ≤ 4 deep)
  ├── Metadata (identity, display text, attribution, provenance, compatibility)
  ├── Color Schemes + Seeds ──▶ reserved seed tokens
  ├── Tokens (primitive group + semantic groups + host extension tokens)
  │     └── Token Value = Literal | Alias | Derivation
  ├── Context Overlays (when → tokens, components, layout)
  ├── Component Styling ──styles──▶ Component Contract (standard registry or Host Declaration)
  ├── Layout Styling ──selects──▶ Layout Variant (Host Declaration)
  ├── Customization Points ──target──▶ tokens or context dimensions
  └── Extension Data (opaque, namespaced)

Host Declaration ── declares ──▶ Extension Contracts, Extension Tokens, Layout Variants
Registries (normative data) ── define ──▶ baseline tokens + defaults, standard contracts,
  standard customization points, context dimensions, transformations, forced-color mapping,
  limits, diagnostic codes, rules
Resolution Input (abstract) + Registries ── resolve ──▶ Resolved Theme + Diagnostics
Conformance Fixture ── exercises ──▶ Rules
```

## 1. Theme Document

The single self-describing document that is a theme (FR-001).

| Field | Required | Content |
|---|---|---|
| `opentheme` | yes | Targeted specification version, `MAJOR.MINOR` (R16) |
| `id`, `version` | yes | Identity (§2) |
| `name` | yes | Display name; other display text is optional (§2) |
| `author`, `license` | export only | Attribution (§2) |
| `provenance` | yes | Origin and lineage (§2) |
| `compatibility` | yes | Catalog version and styled host namespaces (§2) |
| `extends` | no | Base theme reference (§10) |
| `colorSchemes` | yes | Supported schemes and the default (§3) |
| `seeds` | yes | Seed values (§3) |
| `tokens` | no | Token groups (§4) |
| `contexts` | no | Ordered context overlays (§6) |
| `components` | no | Styling of contracts (§7) |
| `layout` | no | Layout variant selections (§8); layout tokens live in the `layout` token group |
| `customization` | no | Customization points (§9) |
| `$extensions` | no | Opaque extension data (§11) |
| `integrity` | export only | `sha256-…` over the canonical form (R3) |

**Validation**:

- The document is I-JSON and at most 1 MiB (R1, R14).
- Unknown members outside `$extensions` are errors (FR-059).
- Every limit in R15 applies.
- Only grammar-defined values are accepted; no field accepts free-form code, styling text,
  selectors, or addresses (FR-066).

## 2. Theme Metadata

| Field | Rules |
|---|---|
| `id` | Reverse-domain identifier (R5). Stable across versions (FR-004). Reserved prefixes may be used only by specification-owned themes |
| `version` | Semantic version 2.0.0 string (FR-005) |
| `name` | Plain text, 1 to 100 characters (FR-006, FR-011) |
| `description` | Optional plain text, up to 1,000 characters |
| `keywords` | Optional; up to 16 plain-text items of up to 32 characters each |
| `localized` | Optional map from a BCP 47 language tag to `{ name?, description? }`; at most 64 entries. Lookup follows RFC 4647 "lookup": exact tag, then progressively shorter tags, then the default (US3 scenario 1) |
| `author` | `{ name }`: plain text, optional for local themes and required for export (FR-007). No URLs or email addresses (FR-066, NFR-008) |
| `license` | SPDX license expression, required for export (FR-007) |
| `provenance.origin` | One of `specification-baseline`, `prebuilt`, `developer-authored`, `user-created`, `imported`, `ai-generated`, `ai-assisted` (FR-008). Informational only (FR-010) |
| `provenance.lineage` | Ordered list of `{ id, version }` for the themes this one was derived from, oldest first; up to 32 entries |
| `compatibility.catalog` | Standard component catalog version the theme styles, `MAJOR.MINOR` |
| `compatibility.extensions` | Map from host namespace to contract-set version the theme styles (FR-009) |

**Display text** (all plain-text fields) must not contain C0 or C1 control characters,
bidirectional embedding, override, or isolate controls (U+202A–U+202E, U+2066–U+2069), or
noncharacters. Natural right-to-left text is allowed, and so are the directional marks U+200E,
U+200F, and U+061C. Display text is never interpreted (FR-011).

## 3. Color Schemes and Seeds

| Field | Rules |
|---|---|
| `colorSchemes.supported` | Non-empty set drawn from `light`, `dark`, and declared variants (FR-025) |
| `colorSchemes.default` | One of `supported` (FB-003) |
| `colorSchemes.variants` | Optional map from a variant name (e.g., `dim`) to `{ fallback: "light" \| "dark" }` (FR-026) |
| `seeds.<scheme>.background` | Required color for every supported standard scheme |
| `seeds.<scheme>.foreground` | Required color for every supported standard scheme |
| `seeds.<scheme>.accent` | Required color for every supported standard scheme |
| `seeds.<variant>.*` | Optional; missing seeds fall back to the variant's `fallback` scheme |
| `seeds.fontFamily` | Required font family list ending in a generic family (FR-022) |

**Derived structure**: seeds are exposed as the reserved tokens `seed.background`,
`seed.foreground`, `seed.accent` (varying by color scheme), and `seed.font-family`. These tokens
may be referenced and derived from, and user values may target them. Themes cannot redefine them
under `tokens` (the `seed` group is reserved).

**Validation** (FR-016, FR-059):

- Every supported standard scheme has all three color seeds.
- Seed colors are opaque.
- In every scheme, the foreground against the background meets at least 4.5:1 after
  quantization (R6, R8).

## 4. Tokens

A **token** is a named, typed value at a **token path**.

- **Path grammar**:
  - A local path is dot-separated segments matching `[a-z][a-z0-9-]*`, at most 64 characters per
    segment and 256 in total.
  - Host extension tokens use a qualified path, `<host-namespace>/<local path>`.
  - Paths are unique (FR-019).
- **Reserved groups**:
  - `seed` holds seeds (§3).
  - `primitive` holds theme-internal raw values. These are not host-facing (FR-014) and never
    appear in the resolved output.
  - Standard semantic groups are defined by the baseline registry: `color`, `font`, `text`,
    `space`, `size`, `radius`, `border`, `elevation`, `opacity`, `motion`, `focus`,
    `breakpoint`, and `layout`.
- **Group members**: groups may carry `$description`, `$deprecated`, and `$extensions`.
  Members starting with `$` are reserved.

| Token member | Rules |
|---|---|
| `$type` | One of the closed types (R4); inherited from the nearest ancestor group that declares it |
| `$value` | Literal of `$type`, or an alias string `{path}` to a token of a compatible type (FR-017). Exclusive with `$derive` |
| `$derive` | Derivation (§5). Exclusive with `$value` |
| `$description` | Optional plain text |
| `$deprecated` | Optional `true` or a replacement hint `{ replacement: path, note? }` (FR-023) |
| `$extensions` | Optional opaque data (§11) |

**Literal grammars** (FR-013):

| Type | Grammar |
|---|---|
| `color` | `{ colorSpace: "srgb" \| "oklch", components: [3 numbers in range], alpha?: 0..1, hex?: "#rrggbb" }` |
| `dimension` | `{ value: number, unit: "px" }`, with per-role ranges from the registry (e.g., sizes ≥ 0) |
| `fontFamily` | Array of 1 to 8 family names, ending in a generic family (`serif`, `sans-serif`, `monospace`, `system-ui`, `ui-rounded`, and others the registry lists), optionally keyed by script (`{ default: [...], "Arab": [...], "Hani": [...] }`) |
| `fontWeight` | Integer 1 to 1000 |
| `number` | Finite number within the role's range |
| `opacity` | Number 0 to 1 |
| `duration` | `{ value: 0..1000, unit: "ms" }` |
| `cubicBezier` | `[x1, y1, x2, y2]` with x values in [0, 1] |
| `strokeStyle` | `solid` \| `dashed` \| `dotted` |
| `border`, `shadow`, `typography` | Composites whose members are the above types or aliases |
| `density` | `compact` \| `standard` \| `comfortable` |

**Physical versus logical**: directional values (e.g., asymmetric spacing, shadow x offsets) are
logical by default and mirror in right-to-left layouts. A composite member may carry
`"physical": true` to opt out explicitly (FR-077).

**Semantic baseline** (registry, FR-015): each standard semantic token has a path, a type, a
description, an example, a specification default (a literal, alias, or derivation; R10), a
separate high-contrast default for color types, and a forced-color role for color types
(FR-054). The baseline also declares contrast pairs and distinguishable role pairs (§12).

## 5. Derivation

`$derive: { op: <transformation id>, args: { <name>: operand, ... } }`

- An operand is a literal, an alias, or a nested derivation object. Nesting is limited to depth 8
  (R15).
- Operand names, types, and domains come from the transformation registry
  ([contracts/transformations.md](./contracts/transformations.md)).

**Validation** (FR-018):

- The op is known.
- Every required argument is present, and no unknown argument appears.
- Operand types match, and literal operands lie within their domains.
- The output type matches the token's `$type`.
- The composition depth and the effort budget (R15) are respected.
- The derivation takes part in cycle detection alongside aliases.

## 6. Context Overlay

An element of the ordered `contexts` array (R11).

| Field | Rules |
|---|---|
| `when` | Non-empty map over the dimensions `colorScheme`, `contrast`, `motion`, `density`, `sizeClass`, each with one value from that dimension's closed set |
| `tokens` | Partial token groups overriding values (types must match the base declaration) |
| `components` | Partial component styling (§7) |
| `layout` | Partial layout styling (§8) |

**Validation**:

- No two overlays have identical `when` maps.
- An overlay may not introduce a token that has no base declaration and no registry default.
- A `colorScheme` value must be supported.
- For each supported scheme, the high-contrast mode (declared `contrast: high` values plus the
  seed-derived high-contrast defaults) must meet FR-027. A failure is an error (FR-025, FR-027).

**Precedence**: ascending specificity, then the dimension priority contrast > colorScheme > density
> sizeClass > motion (R11). High-contrast color sourcing follows R11.

## 7. Component Contract and Component Styling

A **component contract** (standard in the registry, or declared by a host; FR-029, FR-031):

| Field | Rules |
|---|---|
| `id` | `std/<name>` or `<host-namespace>/<name>` |
| `version` | Semantic version; compatibility per contract (FR-086) |
| `parts` | Names of styleable parts (e.g., `container`, `label`, `icon`, `focus-ring`) |
| `states` | Subset of `default`, `hover`, `focus-visible`, `pressed`, `disabled`, `selected`, `invalid` (host-determined; FR-033) |
| `variants` | Map from axis to values (e.g., `emphasis: [primary, secondary, tertiary, danger]`, `size: [sm, md, lg]`) |
| `properties` | Per part: property name → token type (from R4 types only) |
| `defaults` | Per part, property, and optionally state or variant: an alias to a standard semantic token (FR-029) |
| `pairs` | Contrast pairs `{ foreground, background, kind: text \| large-text \| non-text \| disabled }` over part properties |
| `interactiveParts` | Parts subject to the target-size floor (FR-075) |

**Standard catalog 1.0** (R17):

| Family | Contracts |
|---|---|
| Buttons | `std/button`, `std/icon-button` |
| Form controls | `std/text-input`, `std/checkbox`, `std/radio`, `std/switch`, `std/select` |
| Form structure | `std/form-field` (label, help text, validation message) |
| Cards | `std/card` |
| Navigation | `std/nav-bar`, `std/menu`, `std/tabs` |
| Tables | `std/table` |
| Dialogs | `std/dialog` |

**Component styling** (theme side), found under
`components.<contract id>.parts.<part>.<property>`:

- The value is a token value, or `{ "$states": { <state>: value } }`.
- `components.<contract id>.variants.<axis>.<value>` holds variant-specific part styling.
- `components.<contract id>.contract` gives the contract version the styling targets.

**Validation and applicability**:

- Property names and types must match the contract when it is known to the validator, meaning a
  standard contract or one from a host declaration supplied as input.
- Styling for an unknown or incompatible contract is ignored with an informational diagnostic
  (FR-032, FB-012). It is not an error.
- Themes cannot declare states or variants (FR-033), and component styling carries no content,
  labels, or bindings (FR-034).

## 8. Layout

- **Layout tokens** (baseline `layout.*`, FR-035): container maximum width, content maximum width,
  gutter, grid columns, region spacing, and alignment (an enumeration of host-offered values).
  Each may vary by `sizeClass` overlays.
- **Layout variant selection**: `layout.variants.<region>` is either a variant name or a map from
  size class to a variant name. Only variants the host declares are applicable (FR-036).
- **Validation**:
  - No layout value forces content wider than 320 px: at the narrowest size class, minimum and
    fixed widths plus gutters must fit within 320 px (FR-039).
  - No field can express adding, removing, hiding, reordering, or duplicating content (FR-037),
    so such input fails as unknown members.

## 9. Customization Point

| Field | Rules |
|---|---|
| `id` | `std.<name>` for standard points (registry) or a theme-local identifier `[a-z][a-z0-9-]*`. Stable across theme versions (FR-085) |
| `label`, `description` | Plain text with `localized` variants (FR-040, FR-045) |
| `target` | 1 to 16 token paths, or one context dimension (`colorScheme`, `contrast`, `motion`, `density`) |
| `type` | A token type, or `enum` for dimension targets |
| `constraints` | Exactly one of: `range { min, max, step }` for numbers and dimensions; `range { gamut: "srgb", opaque: true }` for colors (continuous: an out-of-range color is clamped by gamut mapping, with alpha forced to 1); `enum [values]`; or `presets [{ id, label, value }]` |
| `default` | Optional literal that satisfies the constraints (FR-042). The point's **documented default** is this value or, if absent, the theme's own value of the target in the active context (for `std.accent`, the scheme's accent seed) |
| `effectiveRange` | Text-size point only: `{ min, max }` for the effective text scale, with `max ≥ 2` (FR-020) |

**Standard points** (registry, FR-041):

| Identifier | Target | Constraint |
|---|---|---|
| `std.accent` | `seed.accent` in every scheme | Color |
| `std.color-scheme` | Color-scheme dimension | Enum |
| `std.contrast` | Contrast dimension | Enum |
| `std.text-size` | In-app text factor | Range with `min ≥ 1` |
| `std.density` | Density dimension | Enum |
| `std.corner-roundness` | `radius.factor` | Range |
| `std.motion` | Motion dimension | Enum |

A theme opts into a standard point by listing its identifier. The registry supplies the label,
type, and widest constraints, and the theme may narrow them. Reference and prebuilt themes declare
all standard points.

**Validation** (FR-042):

- The documented default satisfies the constraints in every context. When `default` is absent,
  this is checked against the target's theme value.
- Constraints fit the type.
- Targets exist, and target types match.
- For a range, `(max − min) / step` is an integer.
- A text-size range with `min < 1` is invalid (FR-020).

**Same-layer rule**: when several points target one token, the point declared last wins (R12).

**User value states** (FR-044, FB-005 to FB-007; the stored value never changes):

```text
stored ──(point missing or not permitted)──────────▶ skipped (diagnostic)
stored ──(malformed value)─────────────────────────▶ fell-back to default (diagnostic)
stored ──(range: out of bounds, off-step, gamut)───▶ clamped or snapped (diagnostic)
stored ──(enum or preset not allowed)──────────────▶ fell-back to default (diagnostic)
stored ──(within constraints)──────────────────────▶ effective
effective ──(breaks a pair under an AA floor)──────▶ rejected, point uses default (diagnostic)
```

## 10. Inheritance

`extends: { id, version }`, where `version` is an exact version or a caret range `^M.m.p`
(FR-046).

- The base must be supplied in the resolution input's theme set (§14).
- The chain is at most 4 deep and acyclic (FR-047).
- The child's trust level is the lowest trust level in the chain (FR-048).
- The child overrides values, overlays (merged per `when` key), component styling, and
  customization points. A redefined point must keep its identifier and type. Its constraints may
  be narrowed or replaced; replacing them is a breaking change for the child's own versioning.
- **Flattening** (for export, FR-049): apply the chain base-first into one document, drop
  `extends`, and append each base `{ id, version }` to `provenance.lineage`.

## 11. Extension Data and Host Namespaces

- **Host namespaces**: a host namespace is the host's reverse-domain identifier. It qualifies host
  contracts (`com.example.notes/timeline`) and host tokens (`com.example.notes/color.rail`).
  Namespaces may not collide with the reserved ones (`std`, `org.opentheme`, `uid`; FR-031,
  US5 scenario 3).
- **Opaque extension data**: `$extensions` holds a map from a reverse-domain vendor key to any
  JSON value, allowed on the document, groups, tokens, and contracts. It is preserved verbatim
  through read, write, flatten, and canonicalization. Implementations do not interpret it, and it
  never changes the meaning of standard fields or bypasses validation (FR-089, FR-098).

## 12. Accessibility Declarations

| Declaration | Rules |
|---|---|
| Contrast pair | `{ foreground: path, background: path, backdrop?: path, kind }`, where `kind` is `text`, `large-text` (only for roles meeting the size rule, R8), `non-text` (includes focus indicators and control boundaries), or `disabled` (exempt, explicitly marked; FR-073). Declared by the baseline and by contracts (FR-072) |
| Distinguishable pair | `{ a: path, b: path }`. Warns when the OKLab distance is below the registry threshold (FR-073) |
| Forced-color role | Each color token and contract color property maps to one of `canvas`, `canvas-text`, `link-text`, `button-face`, `button-text`, `highlight`, `highlight-text`, `gray-text`, `button-border` (FR-054) |
| Focus indicator | `focus.color` and `focus.width` must not resolve to alpha 0 or a width below 1 px (FR-074). A theme-declared literal that violates this is an error |
| Target size | `size.target.min` is at least 24 px. Interactive part sizes below it are raised at resolution, with a diagnostic (FR-075) |

**Accessibility report** (FR-064): computed per mode (scheme × contrast), listing every pair with
its ratio, threshold, and pass or fail. It is separate from validity. "Conformant" means all
pairs pass in every declared mode.

## 13. Host Declaration

| Field | Rules |
|---|---|
| `openthemeHost` | Specification version `MAJOR.MINOR` |
| `id` | Reverse-domain identifier. It is the host namespace |
| `catalog` | Standard catalog version consumed |
| `consumes` | Optional list of standard token groups and contracts used, for coverage reports (SC-002) |
| `contracts` | Extension contracts (§7). Defaults must alias standard semantic tokens or the host's own extension tokens |
| `tokens` | Host extension semantic tokens: path, type, description, and a default that aliases or derives from standard tokens |
| `layoutVariants` | Map from region to `{ variants: [names], default }` (e.g., `navigation: top \| side \| bottom`) |

**Validation**:

- Namespace rules as in §11.
- Contract structure as in §7.
- Defaults resolve.
- No cycles.
- Every limit in R15 applies.

## 14. Resolution Input (abstract model)

An abstract, normative input model for the resolution algorithm. It is **not** a user-facing
document format: the Customization Policy and User Preferences formats (later features) must
compile into it. See [contracts/resolution.md](./contracts/resolution.md).

| Part | Content |
|---|---|
| `themes` | Available theme documents, each with `trust: trusted \| untrusted` supplied by the host, never by the theme (FR-010). Trust is per document entry, never keyed by identifier; bases are resolved from this list. `theme` is shorthand for one more `trusted` entry |
| `host` | A host declaration, or `null` for standard vocabulary only |
| `selection` | `{ id, version? }`, the user's selected theme |
| `previous` | `{ id, version }` or `null`, the last valid applied theme (FB-001) |
| `platform` | `colorScheme` (`light` \| `dark` \| `no-preference`), `contrast` (`standard` \| `high`), `forcedColors` (boolean), `reducedMotion` (boolean), `textScale` (number > 0) |
| `environment` | `sizeClass`, `locale` (BCP 47), `direction` (`ltr` \| `rtl`) |
| `preferences` | Map from customization point identifier to value |
| `policy` | `availableThemes`, `defaultTheme`, `permittedPoints` (with optional narrowed constraints and a replacement default), `allowedColorSchemes`, `locks` (a token path or a contract property path `components.<contract id>.parts.<part>.<property>` → literal; FR-070), `protected` (the same path forms, or group prefixes), and `accessibilityFloor` (`wcag22-aa` \| `relaxed`) |

## 15. Resolved Theme

| Part | Content |
|---|---|
| `applied` | `{ id, version, fallback: none \| previous \| developer-default \| specification-baseline }` |
| `context` | Effective color scheme, contrast, motion, density, size class, effective text scale, forced colors, direction |
| `tokens` | Map from every standard semantic token path and every host extension token path to a concrete value (quantized color, or a system color role under forced colors; dimensions in px; other literal forms). No primitives, aliases, or derivations remain (FR-057) |
| `components` | contract id → part → property → state or variant → concrete value, for every host-declared and standard contract |
| `layout` | The selected variant per region (resolved layout tokens appear under `tokens`) |
| `displayText` | Name and description selected for `environment.locale` |
| `preferences` | Per point: `effective`, `clamped`, `fell-back`, `skipped`, or `rejected`, with the value used |
| `accessibility` | Report for the effective mode (§12) |
| `diagnostics` | Ordered list (§16) |

## 16. Diagnostic

| Field | Rules |
|---|---|
| `code` | `OT-<AREA>-<NNN>`, listed in the diagnostics registry (R13) |
| `severity` | `error` \| `warning` \| `info`. Only errors affect validity (FR-060) |
| `location` | `{ document: "theme" \| "base:<id>@<version>" \| "host" \| "input", pointer: JSON Pointer }` |
| `rule` | Rule identifier `R-<CHAPTER>-<NNN>` |
| `message`, `hint` | Template identifiers plus parameters restricted to grammar-constrained values (FR-071) |
| `related` | Optional further locations (e.g., the members of a cycle) |

Ordering is by document, then pointer in canonical order, then code, so output is identical
across implementations (NFR-001). At most 200 diagnostics are reported, followed by one
`OT-LIM-099` "truncated" entry (edge case).

## 17. Registries (normative data)

Machine-readable, versioned with the specification, and consumed by implementations and
documentation (Principle IV). Formats are in [contracts/registries.md](./contracts/registries.md).

| Registry | Contents |
|---|---|
| `semantic-baseline.json` | Standard tokens with types, descriptions, examples, defaults, high-contrast defaults, forced-color roles, pairs, and distinguishable pairs |
| `component-catalog.json` | Standard contracts (§7) |
| `customization-points.json` | Standard points (§9) |
| `context-dimensions.json` | Dimensions, values, and priority order (R11) |
| `transformations.json` | Transformation signatures, domains, and effort costs (R9, R15) |
| `forced-colors.json` | System color roles |
| `limits.json` | All resource limits (R15) |
| `diagnostics.json` | Codes, severities, message and hint templates, and rules |
| `rules.json` | Rule identifier → chapter, requirement ids (FR-…), and fixtures (NFR-010) |

## 18. Conformance Fixture

| Field | Rules |
|---|---|
| `id` | Unique fixture identifier |
| `kind` | `validate` \| `resolve` \| `canonicalize` \| `flatten` \| `compare-versions` \| `migrate` \| `kernel` |
| `rules` | One or more rule identifiers exercised (NFR-010) |
| `description` | What the fixture proves |
| `input` | Documents and resolution input per kind |
| `expect` | Validity (`valid` \| `invalid` \| `unsupported`) with an exact diagnostic list (code and location); or a resolved theme or a subset with exact values; or canonical bytes and an integrity hash; or a classification; or a migrated document with its diagnostics |

**Suite classes**: valid, invalid, malicious (at least one per forbidden-content category and per
limit; SC-003), resolution examples (every pair of layers × every dimension; FR-058),
versioning (including the simulated previous major; R16), accessibility sweeps (generated; R10),
and kernel golden vectors (R7).

## 19. Migration Manifest

`{ from: "M.x", to: "N.0", operations: [...] }`, where each operation is one of:

- `rename-path { from, to }`
- `move-member { from, to }`
- `map-value { at, mapping }`
- `drop-member { at, lossy: true }`

Operations are applied in order. Every lossy operation emits a diagnostic (FR-082).

## Document lifecycle

```text
received ─(> 1 MiB)──────────────────────────────▶ invalid (OT-LIM-001, no parse)
received ─▶ parsed ─(I-JSON or structure error)──▶ invalid
parsed ─(newer minor or unsupported major)───────▶ unsupported
parsed ─(previous major within window)───────────▶ migrated ─▶ validated
parsed ─▶ validated ─(any error)─────────────────▶ invalid
validated ─(no errors)───────────────────────────▶ valid ─▶ resolved (per resolution input)
valid ─(accessibility shortfall)─────────────────▶ valid but non-conformant (policy decides)
valid + author + license ────────────────────────▶ export-eligible ─▶ flattened + canonical + integrity
```

**Applied state** (FB-001): `applied(A)` plus the selection of invalid B stays `applied(A)`. With no
previous state, the developer default applies. If that is unavailable or invalid, the
specification baseline theme applies.
