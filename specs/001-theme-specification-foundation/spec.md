# Feature Specification: Theme Specification and Theme Foundation

**Feature Branch**: `001-theme-specification-foundation`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Define the first foundational OpenTheme feature: Theme Specification
and Theme Foundation, the contract all future OpenTheme capabilities depend on. Cover theme identity
and metadata, design tokens, theme modes, component theming, layout and responsive presentation,
customization capabilities, inheritance/overrides/precedence, validation and invalid themes,
security boundaries, accessibility, versioning and compatibility, portability, AI compatibility,
import/export readiness, and future ecosystem compatibility. Do not implement the runtime, React
adapter, marketplace, AI, or Theme Builder."

## Clarifications

### Session 2026-09-25

- Q: Should themes be able to derive token values from other tokens through spec-defined
  transformations? → A: Yes, but only through a closed, deterministic, specification-defined set of
  transformations. Operations are finite, side-effect free, typed, validated before application,
  bounded in cost, and accessibility-compatible, so a user can pick any accent color and the theme
  derives hover, pressed, and disabled states, accessible text and icon colors, variants, borders,
  subtle surfaces, and related colors. Arbitrary expressions, functions, scripts, CSS, and
  application code remain forbidden. A derivation that cannot be evaluated safely or yields an
  invalid value fails validation, and the theme is not partially applied. The exact primitives are
  finalized in planning. (Recorded in FR-018, FR-041, FR-055, FR-059, FR-062, FR-066, FR-096, and
  SC-014.)
- Q: Should the reference themes this feature delivers also be the first official prebuilt themes
  developers can ship to end users? → A: Yes. At least two reference themes are production-quality
  official prebuilt themes, maintained and versioned like any release.
- Q: What is the smallest set of values a theme author must provide for a theme to be valid? → A:
  Seeds only: a background, a foreground, and an accent color for each supported color scheme, plus
  a primary font family. Every other baseline token has a specification default, a literal or a
  derivation from the seeds, and any default can be overridden.
- Q: When a user's customization value is outside the effective constraints, what does resolution
  do? → A: Type-aware handling. Continuous values outside the range are clamped to the nearest
  valid boundary; invalid or no-longer-supported discrete or enumerated values resolve to the
  point's documented default. Stored preferences are never modified or deleted by enforcement and
  may become effective again if constraints widen. The rule is deterministic, identical across all
  adapters, and diagnostics distinguish clamping from fallback.
- Q: How does the in-app text-size preference combine with platform text scaling? → A:
  Multiplicatively, with a bounded effective range. The effective scale is the in-app factor
  (minimum 100%) times the platform factor, then constrained by the theme's or developer's allowed
  range. Accessibility requirements and the platform's requested scale are always preserved, and
  the stored preference is not modified.
- Q: Should every theme automatically have a high-contrast mode derived from its seeds? → A: Yes.
  Every valid theme has a high-contrast mode. Values the author does not define are derived
  deterministically from the seeds by specification-defined transformations and defaults;
  author-defined values are used instead. Either way, the result must pass the same accessibility
  validation. High contrast never makes the user leave their selected theme, and a theme that
  cannot produce a conforming high-contrast result is invalid rather than silently replaced.

## User Scenarios & Testing *(mandatory)*

This feature delivers a contract, not running software. Every story is therefore tested against the
specification's own deliverables (FR-099): the normative rules, the machine-readable schema, the
specification baseline theme, the reference themes, the reference host declarations, and the
conformance suite. "A conforming validator" means any software that implements the specification's
validation rules; expected outcomes are defined by the conformance suite, not by an implementation.

### User Story 1 - Developer offers prebuilt themes without authoring one (Priority: P1)

A developer integrating OpenTheme wants to give end users polished, accessible themes without
designing any. Their application consumes the standard semantic tokens and standard component
contracts. They pick from the official prebuilt themes (the reference themes delivered with this
feature), choose a default, and ship, writing zero theme values.

**Why this priority**: This is the first adoption path the constitution requires (Principle III).
If the specification cannot guarantee that a prebuilt theme fully styles any host that uses the
standard vocabulary, no other capability matters.

**Independent Test**: Take the reference themes and a reference host declaration that uses only
standard vocabulary. Validate each theme and resolve it in every supported mode. Pass if every
value the host consumes is present without a single theme value being authored.

**Acceptance Scenarios**:

1. **Given** a host that consumes only standard semantic tokens and standard component contracts,
   **When** any reference theme is resolved in any mode it supports, **Then** every consumed token
   and every contract property has exactly one concrete value.
2. **Given** a reference theme that does not style a particular standard component contract,
   **When** it is resolved, **Then** that contract's properties take the specification defaults,
   computed from the theme's own semantic tokens, so the component still matches the theme.
3. **Given** a developer who wants their brand color on a prebuilt theme, **When** their developer
   policy locks the relevant semantic tokens to brand values, **Then** those tokens and every token
   that references them resolve to the brand values, and the rest of the theme is unchanged.
4. **Given** the developer's default theme is missing or invalid, **When** a theme is needed,
   **Then** the specification baseline theme is used, and it meets WCAG 2.2 AA in every mode.
5. **Given** any reference theme, **When** its metadata is inspected, **Then** it declares an
   identifier, name, version, author, license, provenance, targeted specification version, and
   compatibility information, and it supports light, dark, and high-contrast modes.

---

### User Story 2 - Invalid and unsafe themes are never applied (Priority: P1)

Developers and end users rely on the specification to guarantee that a theme which is malformed,
unsupported, oversized, or tries to carry code, network behavior, or application logic is rejected
as a whole, with clear diagnostics, while the application keeps a valid appearance.

**Why this priority**: Themes will come from users, other applications, marketplaces, and AI. Safe
rejection is the precondition for every one of those sources (Principle VI).

**Independent Test**: Run the invalid and malicious fixtures of the conformance suite. Pass if each
is classified invalid with its expected diagnostic codes and locations, and no fixture's values are
ever applied, fully or partly.

**Acceptance Scenarios**:

1. **Given** a theme containing a script, raw styling-language text, a selector that targets host
   internals, or a network address, **When** it is validated, **Then** it is invalid, each
   occurrence is reported with its location, and nothing from the theme is applied.
2. **Given** a theme with a reference to a token that does not exist or has an incompatible type,
   **When** it is validated, **Then** it is invalid and each broken reference is reported.
3. **Given** references that form a cycle, directly or through an inheritance chain, **When** the
   theme is validated, **Then** it is invalid and the diagnostic lists the tokens in the cycle.
4. **Given** a theme that exceeds any resource limit, **When** it is validated, **Then** it is
   rejected with bounded effort and the diagnostic names the exceeded limit.
5. **Given** a theme that targets a newer specification version than the validator supports,
   **When** it is evaluated, **Then** it is unsupported, not applied, and the diagnostic states the
   version required.
6. **Given** a theme with several independent errors, **When** it is validated, **Then** all
   detectable errors are reported in a single pass.
7. **Given** a user whose valid theme A is applied, **When** they select invalid theme B, **Then**
   theme A remains applied in full.
8. **Given** an imported theme that claims the identifier of a developer-bundled theme, **When** it
   is evaluated, **Then** it never replaces, shadows, or is presented as the bundled theme.
9. **Given** a theme with a derived value that uses a transformation the specification does not
   define, a free-form expression, operands of the wrong type, or a composition deeper than the
   limit, **When** it is validated, **Then** it is invalid and nothing from it is applied.

---

### User Story 3 - End user selects an available theme and mode (Priority: P2)

An end user browses the themes the developer made available, sees their names and descriptions in
their own language, picks one, and chooses light or dark. Their platform accessibility settings
(increased contrast, forced colors, reduced motion, larger text) are honored automatically.

**Why this priority**: Selection is the first user-visible personalization. It depends on the theme
format and validation delivered by the P1 stories.

**Independent Test**: Use the resolution examples that vary the selected theme and the context
(color scheme, contrast, motion, forced colors, text size, writing direction). Pass if each example
resolves to its single documented result.

**Acceptance Scenarios**:

1. **Given** a theme with a Persian name and description, **When** the user's language is Persian,
   **Then** the Persian text is available; for languages without a localization, the default name
   and description are used.
2. **Given** the user explicitly chose dark mode while the platform prefers light, **When** the
   theme resolves, **Then** dark-mode values are used.
3. **Given** the platform requests increased contrast, **When** the theme resolves, **Then**
   the selected theme's high-contrast mode is used regardless of in-app choices, including when the
   theme declares no high-contrast values (they are derived from its seeds), and standard-contrast
   values are never used.
4. **Given** the platform requests reduced motion, **When** the theme resolves, **Then** every
   motion value is its reduced-motion value, even if the user or developer chose standard motion.
5. **Given** forced colors are active, **When** the theme resolves, **Then** every color resolves
   to the platform system color for its role.
6. **Given** a theme that supports only dark mode and a user who prefers light, **When** the theme
   resolves, **Then** its dark mode is used and an informational diagnostic is produced.
7. **Given** a right-to-left locale, **When** the theme resolves, **Then** every directional value
   is mirrored, except values the theme explicitly marks as physical.

---

### User Story 4 - End user customizes permitted appearance properties (Priority: P2)

An end user adjusts accent color, text size, density, or corner roundness within what the theme
exposes and the developer permits. Their choices are kept separately from the theme, survive theme
updates and theme switches where applicable, and can be reset.

**Why this priority**: Personalization is OpenTheme's differentiator (Principle II). It builds on
selection and on the precedence model.

**Independent Test**: Use resolution examples that combine a theme's customization points, a
policy's permissions, and user values. Pass if each resolves to its single documented result.

**Acceptance Scenarios**:

1. **Given** a theme that exposes the accent color and a policy that permits any color, **When**
   the user picks an arbitrary accent, **Then** every token that references or is derived from the
   accent (hover, pressed, and disabled states, lighter and darker variants, borders, and subtle
   surfaces) is recomputed from it, except locked or protected tokens.
2. **Given** the user picks a very light or very dark accent, **When** the theme resolves, **Then**
   the text and icon colors derived for use on the accent meet WCAG 2.2 AA against it, without the
   theme author predefining that accent.
3. **Given** a customization point the theme exposes but the policy does not permit, **When** a
   user value exists for it, **Then** the value is ignored and a diagnostic is produced.
4. **Given** a user value outside the effective constraints, **When** it is applied, **Then** a
   range value is clamped to the nearest boundary and a list or preset value falls back to the
   point's default (FR-044). A diagnostic says which of the two happened, and the value is never
   silently applied as given.
5. **Given** a policy that enforces WCAG 2.2 AA, **When** a user value would make any declared
   color pair fall below AA even after derivation, **Then** that value is rejected and the theme
   otherwise applies.
6. **Given** a user who chose a larger text size and compact density, **When** they switch to
   another theme that supports those standard customization points, **Then** both choices carry
   over.
7. **Given** a theme update that removes a customization point the user had set, **When** the new
   version resolves, **Then** that preference is skipped with a diagnostic and all other
   preferences apply.
8. **Given** compact density, **When** the theme resolves, **Then** no interactive part is smaller
   than the minimum target size.
9. **Given** a stored preference that was clamped after the developer narrowed a range, **When** the
   developer later widens the range to include it again, **Then** the original stored value applies
   unchanged.
10. **Given** an allowed effective text-scale range of 100% to 200%, **When** the platform requests
    150% and the user chooses 120% in the app, **Then** text resolves at 180%. **When** the user
    then chooses 150%, giving 225%, **Then** text resolves at 200%. **When** the platform alone
    requests 250%, **Then** text resolves at 250%, because the platform's requested size is never
    reduced.

---

### User Story 5 - Host-defined component contracts and cross-application portability (Priority: P2)

A host application has components beyond the standard catalog, such as a timeline or a media
player. It declares them as extension contracts in its own namespace so themes can style them.
Themes made for one application still work in another compatible application.

**Why this priority**: Without extensions, real applications cannot be fully themed; without
portability, sharing and marketplaces have no value (Principles I and XIII).

**Independent Test**: Apply every reference theme to two reference host declarations that have
different extension contracts. Pass if both hosts are fully styled with no edits and every scenario
below holds.

**Acceptance Scenarios**:

1. **Given** a host extension contract whose defaults reference standard semantic tokens, **When**
   a theme that does not know the contract is applied, **Then** the contract resolves from its
   defaults using the theme's semantic values.
2. **Given** a theme that styles a host extension contract, **When** it is applied to another host
   that lacks that contract, **Then** that styling is ignored without error and the rest of the
   theme applies in full.
3. **Given** a host extension namespace that collides with a reserved namespace, **When** the host
   declaration is validated, **Then** it is invalid.
4. **Given** a theme that styles version 1 of a host contract, **When** the host now declares an
   incompatible version 2, **Then** that styling is treated as not applicable, the rest applies,
   and a diagnostic is produced.
5. **Given** a host that declares navigation-placement layout variants, **When** a theme selects
   the side placement for the expanded size class, **Then** that variant is used for that size
   class, and content, reading order, and focus order are unchanged.
6. **Given** a theme that tries to hide, add, or reorder content, **When** it is validated,
   **Then** it is invalid, because the specification has no field that can express it.

---

### User Story 6 - Specification and theme versions evolve without breaking users (Priority: P3)

The specification, themes, and user preferences will all change over time. Developers and end users
need assurance that valid themes keep working and that breaking changes are explicit and migratable.

**Why this priority**: Required before the first stable release is published, but it does not block
authoring or validating the first themes.

**Independent Test**: Evaluate the version-compatibility fixtures, including a simulated earlier
major version with its migration. Pass if outcomes match the documented results.

**Acceptance Scenarios**:

1. **Given** a theme valid under version 1.0, **When** it is evaluated by a validator supporting
   1.3, **Then** it is valid and resolves to equivalent output.
2. **Given** a theme using a deprecated element, **When** it is validated, **Then** it is valid and
   a warning names the replacement.
3. **Given** a theme targeting the previous major version within its deprecation window, **When**
   it is evaluated, **Then** it is migrated deterministically and any lossy change is reported.
4. **Given** a new theme version that removes a customization point or changes its type, **When**
   it is compared with the previous version, **Then** the theme-versioning rules classify the
   change as breaking, requiring a new major theme version.

---

### User Story 7 - End users create, save, and share themes with the same specification (Priority: P3)

Later, end users will create themes, from scratch or by deriving from an existing theme, save them,
and share them. This feature guarantees they can do so with the same format, rules, and safety as
prebuilt themes.

**Why this priority**: Authoring and sharing are later features; this story only ensures the
specification does not block them.

**Independent Test**: Validate user-created and derived fixture themes, export them, and import
them elsewhere. Pass if every scenario below holds.

**Acceptance Scenarios**:

1. **Given** a user-created theme that extends a prebuilt theme, **When** it is validated, **Then**
   exactly the same rules apply as for any theme, and it is treated as untrusted.
2. **Given** a user exports that theme, **When** the export is produced, **Then** it is a single
   self-contained document with its lineage in provenance, an author, a license, and an integrity
   hash, and it contains no user preferences or host data.
3. **Given** that export is imported into another compatible host, **When** it is evaluated,
   **Then** its canonical form and integrity hash are unchanged and it resolves equivalently for
   the standard vocabulary.
4. **Given** a theme without an author or license, **When** it is prepared for export, **Then** it
   is not eligible for export and the diagnostic names the missing fields; it remains usable
   locally.

---

### User Story 8 - AI generates or modifies a theme through the specification (Priority: P3)

Future AI features, and the AI coding agents developers already use, need to produce themes that
are valid, bounded, and safe using nothing but the specification.

**Why this priority**: AI capabilities come later (Principle VII), but the specification must be
AI-consumable from its first release; retrofitting descriptions and constraints is costly.

**Independent Test**: Give AI models only the machine-readable specification and examples and ask
them to generate and modify themes. Pass if SC-008 is met.

**Acceptance Scenarios**:

1. **Given** only the machine-readable specification and examples, **When** an AI generates a theme
   from a description such as "calm, low-saturation dark theme", **Then** the result is valid, or
   its diagnostics are sufficient to correct it.
2. **Given** an existing theme, **When** an AI makes a change such as "increase corner roundness",
   **Then** the change is expressible as edits to addressable values, and the result passes full
   validation.
3. **Given** AI output that includes anything outside the specification (code, styling text,
   network addresses), **When** it is validated, **Then** it is invalid exactly as any other theme
   would be; there is no AI-specific exception.
4. **Given** an AI-generated theme, **When** its metadata is inspected, **Then** its provenance can
   record AI generation, and the theme is treated as untrusted.

---

### Edge Cases

- A theme that defines only the seed tokens still resolves completely in every mode it declares,
  including high contrast, because every other value comes from specification defaults, most of
  them derived from the seeds (FR-016).
- A theme that contains only metadata is invalid, because the seed tokens are missing.
- A theme declares dark support but gives seeds only for light: invalid, because every supported
  color scheme needs its own seeds.
- A theme's foreground seed does not meet AA against its background seed: invalid, with a
  diagnostic pointing to both seeds.
- A child theme overrides a base token with a value of a different type: invalid.
- A base theme is updated to a compatible version that removes a token the child references: the
  child becomes invalid, and the last valid state stays applied.
- A user preference overrides a token that other tokens reference or derive from: those tokens see
  the user's value (FR-055). User values are literal, so they can never create a reference cycle.
- A derivation chain loops back on itself (e.g., A derives from B, which derives from A): a
  reference cycle, so the theme is invalid.
- A user picks an accent for which no achievable color meets the target contrast for a declared
  pair (e.g., an accent close to the surface color used for its border): the contrast-aware
  transformation returns the most legible achievable color, the accessibility check still applies,
  and under an AA-enforcing policy the accent is rejected per FB-007.
- A derivation's literal operands are outside the transformation's domain (e.g., a mix ratio above
  100%): the theme is invalid. Values that reach a transformation from users are already checked
  against the customization point's constraints, and transformations are total over their domain,
  so a valid theme cannot become invalid because of a permitted user value.
- A color pair uses translucent colors: contrast is evaluated on the composited result against the
  declared backdrop.
- Disabled-state pairs are exempt from minimum contrast, as WCAG allows, but must be declared as
  disabled-state pairs so the exemption is explicit.
- A theme declares no high-contrast values: when increased contrast is requested, its
  seed-derived high-contrast mode is used, and the user stays in the selected theme.
- A theme declares high-contrast values that miss the enhanced thresholds: the theme is invalid,
  with diagnostics naming the failing pairs. It is not silently repaired with derived values or
  replaced by another theme.
- A theme makes destructive actions look the same as primary actions: the theme is valid, an
  accessibility warning is produced for the declared distinguishable role pair, and developers can
  protect those roles through policy.
- A font family is unavailable on the host, or has no glyphs for the user's script: the declared
  fallbacks apply, ending in a generic family.
- A theme sets breakpoint thresholds that conflict with host behavior: the host still determines the
  active size class, and developer policy may lock the thresholds.
- Two documents share an identifier and version but differ in content: their integrity hashes
  differ, and they are treated as distinct and flagged.
- Two documents differ only in formatting or field order: they have an identical canonical form and
  integrity hash.
- A display name is written in a right-to-left script: allowed. A display name contains
  bidirectional override controls: invalid. A display name contains markup: shown as literal text,
  never interpreted.
- A theme styles a host contract version newer than the host declares: treated as not applicable,
  with a diagnostic.
- Motion durations above the maximum, negative or zero sizes where not allowed, or non-numeric
  numbers: invalid values.
- An unknown field appears outside an extension area: invalid, which protects against typos. An
  unknown field inside an extension namespace: preserved and ignored.
- A policy locks a token that a customization point targets: the point is not offered; not an error.
- Two customization points affect the same token: resolved by the documented same-layer rule
  (FR-056).
- A theme has more errors than the diagnostic cap: errors up to the cap are reported, together with
  the fact that the list was truncated.

## Requirements *(mandatory)*

### Functional Requirements

**Specification form**

- **FR-001**: The Theme Specification MUST define a theme as a single, self-describing, declarative
  data document with one canonical, text-based interchange representation that every conforming
  implementation can read.
- **FR-002**: The Theme Specification MUST be published as normative rules plus a machine-readable
  schema that are kept consistent with each other, and every normative rule MUST be covered by at
  least one conformance fixture.
- **FR-003**: Every element the specification defines (fields, token types, standard tokens,
  component contracts, context dimensions, customization points, diagnostic codes) MUST have a
  stable name, a human-readable description, its constraints, and at least one example in the
  machine-readable schema.

**Theme identity and metadata**

- **FR-004**: Every theme MUST declare a stable identifier that is globally unique without a
  central registry, never changes across the theme's versions, and is independent of its display
  name.
- **FR-005**: Every theme MUST declare its own version using semantic versioning. A specific theme
  release is identified by its identifier and version together.
- **FR-006**: Every theme MUST declare a display name and MAY declare a description, keywords, and
  localized variants of its name and description keyed by standard language tags.
- **FR-007**: Themes MUST support author attribution and a license declared as a standard license
  expression (e.g., SPDX). Both MUST be present for any theme that is exported, shared, or
  published, and MAY be omitted for private local themes.
- **FR-008**: Themes MUST support provenance: an origin category (at least specification baseline,
  prebuilt, developer-authored, user-created, imported, AI-generated, and AI-assisted) and lineage
  (the identifier and version of each theme it was derived from).
- **FR-009**: Themes MUST declare compatibility information: the targeted Theme Specification
  version; the standard component catalog version and any host extension namespaces (with versions)
  they style; their supported color schemes; and their base theme, if any.
- **FR-010**: Provenance and all other self-declared metadata MUST be informational only. Trust MUST
  be determined by how a host obtained a theme, never by what the theme claims about itself.
- **FR-011**: Display text (names, descriptions, labels) MUST be plain text that is never
  interpreted as markup or code, MUST be length-limited, and MUST NOT contain control characters,
  including bidirectional override and embedding controls. Natural right-to-left text MUST be
  allowed.

**Design tokens**

- **FR-012**: The specification MUST define a closed set of token types covering at least: color;
  dimension (for spacing, sizing, border radius, border width, and breakpoints); typography (font
  family, size, weight, line height, letter spacing, and composite text styles); border
  (composite); shadow and elevation (composite); opacity; duration; easing; and density level.
- **FR-013**: Every token type MUST have a precise value grammar and allowed range. A value that
  does not match its type's grammar and range MUST make the theme invalid, and no token type may
  accept free-form text.
- **FR-014**: Tokens MUST be organized into primitive tokens (theme-internal raw values such as
  palettes and scales) and semantic tokens (values named by their role). Hosts MUST consume only
  semantic tokens and component contract properties; primitive tokens are not part of the
  host-facing contract.
- **FR-015**: The specification MUST define a standard semantic token baseline, a domain-neutral
  vocabulary every host can rely on, covering at least: surfaces at several elevation levels; text
  (primary, secondary, disabled, and text on accent or action colors); borders and dividers; primary
  and secondary actions; links; focus indicators; selection; overlays; status roles (success,
  warning, danger, info), each with foreground and background; typography roles (body, headings,
  label, caption, monospace); a spacing scale; a radius scale; border widths; elevation levels;
  opacity roles; motion durations and easings; control sizing, including a minimum target size; and
  breakpoint thresholds.
- **FR-016**: The only tokens every theme must define MUST be the seed tokens: a background color,
  a foreground (primary text) color, and an accent color for each color scheme the theme supports,
  plus one primary font family that applies to all modes. Every other baseline token MUST have a
  specification default that is either a literal or a derivation (FR-018) from the seeds and other
  baseline tokens, so a theme that defines only the seeds resolves completely in every mode it
  declares. Themes MAY override any specification default. Specification defaults:
  - are resolved like any derived value (FR-055), so changing a seed, for example through the
    user's accent choice, recomputes every default derived from it;
  - MUST make every default-derived pair meet WCAG 2.2 AA for any seeds whose own foreground and
    background pair meets AA;
  - MUST derive high-contrast values from the seeds alone that meet FR-027 for any valid seeds, so
    every theme has a conforming high-contrast mode without declaring high-contrast values
    (FR-025).
  Adding a seed token is a breaking change to the specification and MUST happen only in a major
  version.
- **FR-017**: Tokens MUST be able to reference other tokens (aliases) by stable path. A reference
  MUST resolve to an existing token of a compatible type.
- **FR-018**: Token values MUST be literal values, references, or derived values. A derived value
  applies a transformation, or a bounded composition of transformations, to other tokens' values
  and literal operands. Transformations MUST come from a finite set defined by the specification;
  themes MUST NOT define their own transformations or use any other expression, function, script,
  styling text, or application code. Every transformation MUST:
  - be fully specified, with typed inputs, a typed output, and a declared input domain;
  - be deterministic and side-effect free, with exact computation and rounding rules, so every
    conforming implementation produces identical results for the same inputs;
  - operate only on theme token values, literal operands, and context dimensions;
  - be total over its input domain, producing a valid value of its output type for every valid
    input (e.g., through defined clamping or gamut mapping);
  - be checked during validation (transformation name, operand types, operand domains, and output
    type) before anything is applied;
  - count toward resource limits, with a bounded composition depth and bounded evaluation effort.
  A derivation that is unknown, ill-typed, outside its domain, or over its limits MUST make the
  theme invalid, and the theme MUST NOT be partially applied. The finite set MUST cover at least:
  mixing two colors; adjusting lightness, saturation, hue, and transparency; contrast-aware
  selection or adjustment that yields a color meeting a target contrast against a given
  background where achievable, or the most legible achievable color otherwise; and scaling and
  clamping numbers and dimensions. The exact primitives are finalized in planning.
- **FR-019**: Token paths MUST be unique within a theme, and the specification MUST define naming
  rules, including allowed characters and reserved prefixes.
- **FR-020**: Dimensions MUST be expressed in platform-neutral units with a deterministic mapping to
  each platform. Font sizes and line heights MUST scale by the effective text scale, computed
  deterministically:
  - the in-app factor is the user's value for the standard text-size customization point, handled
    per FR-044. Its range MUST have a minimum of at least 100%, so OpenTheme never reduces the
    platform's requested text size; a text-size point whose range goes below 100% makes the theme
    invalid;
  - the effective text scale is the platform text-scaling factor multiplied by the in-app factor,
    then clamped to the allowed effective range. The theme declares that range, or uses a
    specification default if it declares none, and developer policy MAY narrow it (FR-043);
  - the allowed range MUST NOT prevent WCAG 2.2 text resizing, so its maximum MUST be at least
    200%. The result MUST never be below the platform text-scaling factor, even if the platform
    factor exceeds the range's maximum;
  - applying the range MUST NOT modify the stored preference.
- **FR-021**: Color values MUST be expressed in defined color spaces with deterministic conversion,
  supporting at least sRGB and translucency.
- **FR-022**: Font family values MUST be ordered fallback lists ending in a generic family, and MAY
  vary by script or language (e.g., distinct families for Arabic-script or CJK text).
- **FR-023**: Tokens and other specification elements MAY be marked deprecated, with a replacement
  hint.

**Theme modes and context dimensions**

- **FR-024**: The specification MUST define standard context dimensions along which values may
  vary: color scheme (at least light and dark), contrast (at least standard and high), motion
  (standard and reduced), density (at least compact, standard, and comfortable), and size class (at
  least three named responsive tiers).
- **FR-025**: Every theme MUST declare which color schemes it supports, MUST support at least one,
  and MUST name one of them as its default color scheme. Every valid theme MUST have a high-contrast
  mode for each supported color scheme:
  - high-contrast values the author declares are used;
  - every other high-contrast value is derived deterministically from the seeds by specification
    defaults (FR-016);
  - the resulting high-contrast mode MUST pass the same validation as any other mode, plus FR-027.
    If it cannot, the theme is invalid; it is never silently replaced by another theme;
  - requesting high contrast MUST NOT move the user away from the selected theme.
  The specification baseline theme, reference themes, and prebuilt themes MUST support both light
  and dark color schemes.
- **FR-026**: Themes MAY declare additional named color-scheme variants (e.g., "dim") only if each
  names the standard color scheme it falls back to.
- **FR-027**: Every high-contrast mode, whether author-declared, derived, or a mix of both, MUST
  have text pairs that meet WCAG 2.2 enhanced contrast (7:1, or 4.5:1 for large text) and non-text
  pairs that meet at least 3:1. A high-contrast mode that misses these thresholds makes the theme
  invalid.
- **FR-028**: Every motion token MUST have a reduced-motion value, declared by the theme or supplied
  by a specification default, that removes non-essential movement.

**Component theming**

- **FR-029**: The specification MUST define the component contract: a named, versioned declaration
  of a styleable interface element that lists its parts; its host-determined states (at least
  default, hover, focus-visible, pressed, disabled, selected, and invalid); its host-declared
  variants (e.g., emphasis, size); the styleable properties of each part, limited to specification
  token types; the color pairs that require contrast checking; and a default for every property,
  expressed as a reference to a standard semantic token.
- **FR-030**: The specification MUST include a standard catalog of domain-neutral component
  contracts covering at least: buttons; text inputs and other form controls; form structure
  (labels, help text, validation messages); cards; navigation (bars, menus, tabs); tables; and
  dialogs.
- **FR-031**: Hosts MUST be able to declare their own component contracts in a host-owned namespace
  with the same structure, versioning, defaults, and contrast pair declarations as standard
  contracts. Host namespaces MUST NOT collide with namespaces the specification reserves.
- **FR-032**: Themes MAY style any standard or host extension contract. Styling for a contract the
  host does not declare in a compatible version MUST be ignored without error. A declared contract
  that the theme does not style MUST resolve from its defaults using the theme's semantic tokens.
- **FR-033**: Themes MAY style how states and variants look, but MUST NOT define new states, the
  conditions for entering states, or which variant an element uses; those are determined by the
  host.
- **FR-034**: Component contracts MUST describe appearance only and MUST NOT carry content, labels,
  data bindings, business meaning, or behavior.

**Layout and responsive presentation**

- **FR-035**: Themes MUST be able to express presentation-level layout through layout tokens:
  container and content maximum widths, gutters, grid column counts, spacing between regions, and
  alignment among host-offered options, each of which MAY vary by size class.
- **FR-036**: Hosts MAY declare layout variants that they fully implement (e.g., navigation
  placement, list or grid presentation). Themes MAY select among the declared variants per size
  class.
- **FR-037**: Themes MUST NOT add, remove, hide, reveal, reorder, or duplicate content or regions,
  and MUST NOT change reading or focus order. The host remains responsible for the order and
  accessibility of every layout variant it declares.
- **FR-038**: The active size class MUST be an input to resolution supplied by the host. Breakpoint
  threshold tokens have specification defaults, MAY be set by themes, and MAY be locked by developer
  policy.
- **FR-039**: Layout values MUST NOT force content wider than the narrowest supported size class
  (equivalent to 320 CSS pixels), so content can reflow.

**Customization capabilities**

- **FR-040**: Themes MUST be able to declare customization points, each with a stable identifier, a
  localizable label and description, a target (one or more tokens, or a standard context
  dimension), a value type, constraints (a range with a step, an enumerated list, or preset
  options), and a default value.
- **FR-041**: The specification MUST define standard customization points with well-known
  identifiers, at least: accent color, color scheme, contrast, text size, density, corner roundness,
  and motion. Preferences for standard points MUST carry over between themes that support them.
  Reference and prebuilt themes MUST support all standard customization points and MUST derive
  every accent-related token (e.g., hover, pressed, and disabled states; text and icons on the
  accent; lighter and darker variants; borders; subtle surfaces) from the accent value.
- **FR-042**: A customization point declaration MUST be internally consistent: its default satisfies
  its constraints, its constraints fit its value type, its targets exist, and a range's maximum is
  reachable from its minimum in whole steps. Otherwise the theme is invalid.
- **FR-043**: Customization points declare what may be customized; they grant nothing by
  themselves. The effective set MUST be the theme's declared points that developer policy permits,
  and policy MAY narrow but MUST NOT widen a point's constraints. If narrowed constraints exclude
  the theme's default, the policy MUST supply a default that satisfies them; that default is then
  the point's documented default.
- **FR-044**: User-supplied values for customization points MUST be literal values of the declared
  type, never references or expressions, and MUST be checked against the effective constraints
  using this single deterministic rule, which every implementation and adapter MUST apply
  identically:
  - a continuous (range) value outside the range is clamped to the nearest boundary; a value
    inside the range that falls between steps snaps to the nearest step, with ties going to the
    lower value;
  - a discrete value (enumerated list or preset option) that is not currently allowed, including
    one no longer offered, resolves to the point's documented default;
  - a value that is not a well-formed value of the declared type resolves to the point's
    documented default, whatever its constraint kind;
  - clamping and fallback each produce a diagnostic with its own stable code, so callers can tell
    them apart;
  - enforcement MUST NOT modify or delete the stored preference; if the constraints later widen,
    the original value becomes effective again.
- **FR-045**: Customization point declarations MUST carry enough information (type, constraints,
  labels, descriptions) for any personalization interface to present accessible, keyboard-operable
  controls without theme-specific code.

**Inheritance, overrides, and precedence**

- **FR-046**: A theme MAY extend one base theme, identified by its identifier and a compatible
  version range. The child inherits every value and customization point it does not override, and
  MAY override values and redefine or narrow customization points.
- **FR-047**: Inheritance chains MUST be acyclic and within the depth limit. If a base is missing,
  invalid, incompatible, or unsupported, the child MUST be invalid.
- **FR-048**: A theme's trust level MUST be the lowest trust level in its inheritance chain.
- **FR-049**: Themes that are exported, shared, or published MUST be self-contained: the inheritance
  chain is flattened into one document, with lineage recorded in provenance.
- **FR-050**: The specification MUST define these precedence layers, from lowest to highest
  authority:
  1. contract defaults: specification defaults and host contract defaults;
  2. the selected theme, with its base themes applied before the child;
  3. user preferences for effective customization points;
  4. developer policy: available themes and modes, locks, value constraints, and protected tokens;
  5. platform accessibility preferences: forced colors, increased contrast, reduced motion, and
     text scaling.
- **FR-051**: Developer policy MUST be the final authority over layers 1 to 3: locked and protected
  tokens always resolve to developer-defined values, and no user preference can override them.
- **FR-052**: Platform accessibility preferences MUST take precedence over every other layer. In-app
  choices by the user or developer MAY make presentation more accessible than the platform requests
  but MUST NOT make it less accessible; for example, they cannot restore motion when reduced motion
  is requested, reduce text below the platform size, or remove high contrast when it is requested.
- **FR-053**: The active color scheme MUST be chosen in this order: the user's explicit choice, then
  the platform preference, then the developer default, limited to schemes the developer allows and
  the theme supports. Developer policy MAY restrict color schemes but MUST NOT prevent high contrast
  when the platform or user requests it.
- **FR-054**: When forced colors are active, the platform's system colors MUST replace theme colors
  according to a specification-defined mapping from each semantic color role to a platform-neutral
  system color role (at least background, text, link, button face, button text, highlight,
  highlighted text, disabled text, and border). Every standard semantic color token and every
  contract color property MUST map to one.
- **FR-055**: References and derived values MUST resolve against the fully layered values, so an
  override of a token propagates to every token that references it or is derived from it, except
  tokens that are locked or protected.
- **FR-056**: Conflicts within one layer (e.g., two customization points affecting one token) MUST
  be resolved by a single documented, deterministic rule.
- **FR-057**: Resolution MUST produce a complete result: for any valid theme, context, preferences,
  and policy, every standard semantic token and every property of every host-declared contract has
  exactly one concrete value.
- **FR-058**: The specification MUST publish normative resolution examples that cover every pair of
  precedence layers and every context dimension, each with exactly one expected result. The exact
  normative algorithm MAY be refined in planning but MUST preserve FR-050 through FR-057.

**Validation and invalid themes**

- **FR-059**: Validity MUST be determined solely by the specification: a theme is valid if and only
  if validation produces no error-level diagnostics. Errors MUST include at least: malformed
  documents or invalid structure; missing required fields or seed tokens (FR-016); unknown fields
  outside extension areas; unsupported specification versions; references to missing tokens or to
  tokens of an incompatible type; reference cycles, including through derived values and
  inheritance; values outside their type's grammar or range; invalid derivations (FR-018);
  resource-limit violations; forbidden content (FR-066); inheritance errors; inconsistent
  customization declarations; duplicate token paths; invalid display text; declared color schemes
  that lack their seed tokens; seed foreground and background pairs below WCAG 2.2 AA; and
  high-contrast modes that miss the FR-027 thresholds.
- **FR-060**: Warning-level diagnostics (e.g., use of deprecated elements) and informational
  diagnostics MUST NOT affect validity.
- **FR-061**: Validation MUST report all detectable errors in one pass, up to a documented cap. Each
  diagnostic MUST include a stable code, a severity, a precise location in the document, a
  plain-language message, a remediation hint, and a reference to the violated rule.
- **FR-062**: Resource limits MUST be fixed by the specification, not by implementations, so that
  validity is the same everywhere. They MUST cover at least: document size, token count, reference
  chain depth, derivation composition depth, total derivation evaluation effort, structural nesting
  depth, inheritance depth, number of customization points, display text length, and maximum motion
  duration.
- **FR-063**: Validation MUST finish with bounded effort for any input, including inputs far beyond
  the resource limits.
- **FR-064**: Accessibility conformance MUST be evaluated separately from validity and reported per
  mode for every declared pair. A valid theme with accessibility shortfalls is valid but
  non-conformant; whether it may be used is decided by developer policy.
- **FR-065**: An invalid or unsupported theme MUST never be partially applied. Partial application
  means applying some of a theme's applicable values while omitting others because of an error.
  Ignoring styling for contracts a host does not declare (FR-032) is not partial application.

**Security boundaries**

- **FR-066**: Themes MUST be declarative data only. The specification MUST NOT define any field,
  token type, or value grammar that can express: executable code or scripts; styling-language text
  such as raw CSS; selectors or references to host internals (element names, classes, identifiers,
  or structure); network behavior, such as addresses or resource fetches; application logic, or
  conditions beyond the specification's context dimensions; or access to databases, APIs, or
  storage. The specification-defined transformations of FR-018 are value operations on token data,
  not code, and are the only computation a theme can express.
- **FR-067**: In version 1.x of the specification, themes MUST NOT reference external resources.
  Fonts are referenced by family name only, whether provided by the platform or registered by the
  host. Later versions MAY add asset references, only under developer-policy control as the
  constitution requires.
- **FR-068**: An untrusted theme MUST NOT replace, shadow, or be presented as a trusted theme that
  has the same identifier.
- **FR-069**: The specification MUST define a canonical form, so that semantically identical themes
  produce identical canonical representations and identical integrity hashes.
- **FR-070**: Every semantic token and every contract property MUST be individually addressable, so
  that developer policy can lock or protect it (e.g., roles used for warnings, destructive actions,
  or consent text).
- **FR-071**: Diagnostics MUST NOT reproduce untrusted content in a form that could be interpreted
  as markup or code.

**Accessibility**

- **FR-072**: The standard baseline and every component contract MUST declare the color pairs that
  require contrast checking, including text on surfaces, text on actions, non-text indicators,
  form-control boundaries, and focus indicators against adjacent colors.
- **FR-073**: The specification MUST define contrast rules consistent with WCAG 2.2 AA: at least
  4.5:1 for text, 3:1 for large text as WCAG defines it, and 3:1 for non-text interface components
  and focus indicators. Translucent colors MUST be evaluated after compositing against the declared
  backdrop. Disabled-state pairs are exempt but MUST be declared as such. The specification MUST
  also declare distinguishable role pairs, which are semantic roles that must not look alike (at
  least danger versus primary actions). A pair that resolves to colors closer than a
  specification-defined threshold produces an accessibility warning, not an error.
- **FR-074**: Focus indicator tokens MUST always resolve, from the theme or from specification
  defaults derived from the seeds, and MUST NOT resolve to fully transparent or zero-width values.
- **FR-075**: At every density, interactive parts MUST NOT resolve below the WCAG 2.2 minimum target
  size (24 by 24 CSS pixels, or the platform equivalent).
- **FR-076**: Sizes of parts that contain text MUST act as minimums that grow with their content,
  and typography values MUST NOT prevent hosts from honoring user text-spacing adjustments as
  defined by WCAG 2.2.
- **FR-077**: Directional values MUST use logical start and end semantics so themes mirror correctly
  in right-to-left layouts; any intentionally physical value MUST be explicitly marked.
- **FR-078**: The specification baseline theme and every reference theme MUST meet WCAG 2.2 AA for
  every declared pair in every mode, and the FR-027 thresholds in high-contrast modes.

**Versioning and compatibility**

- **FR-079**: The Theme Specification MUST be versioned with semantic versioning. The first stable
  release is 1.0.0; drafts carry pre-release labels and have no compatibility guarantee.
- **FR-080**: Within a major version, changes MUST be additive: every theme valid under 1.x MUST
  remain valid and resolve equivalently under any later 1.y, except for documented bug fixes.
- **FR-081**: An implementation supporting version M.N MUST accept themes targeting M.0 through M.N.
  Themes targeting a newer minor version, or an unsupported major version, MUST be treated as
  unsupported, with a diagnostic stating the required version. Authoring tools SHOULD declare the
  lowest version that covers the features a theme uses.
- **FR-082**: Every new major version MUST include a deterministic migration from the previous major
  version, with diagnostics for any lossy change. Implementations MUST accept themes from the
  previous major version, through migration, during a published deprecation window.
- **FR-083**: Deprecations MUST be announced at least one minor version before removal and MUST
  produce warnings while in effect.
- **FR-084**: The specification MUST define which theme changes are breaking (e.g., removing a
  customization point, changing its type, narrowing its constraints so existing values no longer
  fit, or removing a host-visible token) and therefore require a new major theme version.
- **FR-085**: Customization point identifiers MUST remain stable across theme versions. Preferences
  that refer to removed or incompatible points MUST be skipped with a diagnostic and MUST never
  cause the theme to fail.
- **FR-086**: Component contracts, both standard and host-defined, MUST be versioned with semantic
  versioning, with compatibility determined per contract.

**Portability and domain neutrality**

- **FR-087**: A theme that styles only standard tokens and standard contracts MUST apply without
  modification to any host that consumes them.
- **FR-088**: All specification vocabulary (token names, contract names, dimension names, metadata
  fields) MUST be domain-neutral. Domain-specific needs MUST be expressed through host extension
  namespaces.
- **FR-089**: Host and third-party additions MUST live in namespaced extension areas.
  Implementations MUST preserve extension data they do not understand when reading and writing a
  theme, and MUST NOT let extensions change the meaning of standard fields or bypass validation.

**AI compatibility**

- **FR-090**: The machine-readable specification alone, without prose documentation, MUST be
  sufficient for an automated system to produce a valid theme: purposes, constraints, closed
  vocabularies, and examples are all present.
- **FR-091**: Every value in a theme MUST be addressable by a stable path, so that future structured
  modification formats can target single values.
- **FR-092**: The specification MUST include annotated examples ranging from a minimal valid theme
  (seed tokens only) to a full-featured theme, plus invalid examples with their expected
  diagnostics.
- **FR-093**: Diagnostics MUST be machine-readable, so that an automated system can correct a theme
  using only the diagnostic output.

**Import/export readiness and future ecosystem**

- **FR-094**: Exporting and re-importing a valid theme MUST be lossless: its canonical form and
  integrity hash are unchanged, extension data included.
- **FR-095**: Exported themes MUST contain only theme data and declared metadata, never user
  preferences or host application data.
- **FR-096**: The token model SHOULD map losslessly to and from the W3C Design Tokens Community
  Group format for token types both define, and the specification MUST document the mapping,
  anything that cannot be mapped, and how derived values are represented when exporting (e.g., as
  computed values for a stated context).
- **FR-097**: User-created, designer-created, shared, marketplace, and AI-generated themes MUST use
  the same format, validation, and precedence as prebuilt themes, with no separate format and no
  relaxed rules.
- **FR-098**: Ecosystem-specific metadata (e.g., marketplace listings or ratings) MUST live in
  extension namespaces rather than in the core format, and the format MUST NOT preclude digital
  signatures.

**Specification deliverables**

- **FR-099**: This feature MUST deliver: the normative specification; the machine-readable schema;
  the standard semantic baseline with its defaults; the standard component catalog; the host
  extension contract mechanism; the specification baseline theme, which is always valid; at least
  two reference themes with distinct visual styles that support light, dark, and high contrast and
  that are also the first official prebuilt themes, production-quality, maintained, and versioned
  like any release (with provenance "prebuilt", an author, and a license); at least two reference
  host declarations with different structures and extension contracts; and the
  conformance suite (valid, invalid, and malicious fixtures, resolution examples, and
  version-compatibility fixtures), each with expected outcomes and diagnostic codes.

### Non-Functional Requirements

- **NFR-001 Determinism**: For identical inputs, every conforming implementation MUST produce the
  same validity outcome, the same diagnostic codes and locations, and the same resolved values.
- **NFR-002 Bounded cost**: Validation and resolution effort MUST be bounded by the resource limits;
  no rule may require unbounded computation.
- **NFR-003 Responsiveness**: The specification MUST allow a conforming validator to validate a
  typical theme (up to 1,000 tokens) within 100 ms, and a theme at the resource limits within
  1 second, on a mid-range consumer phone, and MUST allow re-resolution after a context change fast
  enough for live switching without visible delay.
- **NFR-004 Offline**: Validation and resolution MUST NOT require network access, accounts, or any
  external service.
- **NFR-005 Human readability**: Theme documents MUST be text-based and readable by designers and
  developers, with meaningful names, so changes can be reviewed as ordinary text differences.
- **NFR-006 Machine readability**: Every specification element MUST carry a description,
  constraints, and at least one example (FR-003).
- **NFR-007 Internationalization**: Display text MUST be localizable, and the specification MUST
  support right-to-left scripts and script-specific typography.
- **NFR-008 Privacy**: A theme MUST NOT require personal data. Author attribution is optional except
  for distribution and is controlled by the author. The specification MUST NOT define fields
  intended to identify or track users or devices.
- **NFR-009 Openness**: Anyone MUST be able to implement the specification without registration,
  fees, or a proprietary service.
- **NFR-010 Traceability**: Every normative rule MUST map to at least one conformance fixture, and
  every fixture MUST name the rules it exercises.

### Failure Behavior

- **FB-001**: Invalid or unsupported theme: none of it is applied. The last valid applied state
  remains; if there is none, the developer's default theme is used; if that is unavailable or
  invalid, the specification baseline theme is used. Diagnostics are produced.
- **FB-002**: Base theme missing, invalid, incompatible, or unsupported: the child is invalid and
  FB-001 applies.
- **FB-003**: Requested color scheme not supported by the selected theme: the theme's declared
  default scheme (or a variant's declared fallback) is used, with an informational diagnostic. The
  user's theme choice takes priority over their color-scheme preference.
- **FB-004**: Increased contrast requested: the selected theme's high-contrast mode for the active
  color scheme is used. Every valid theme has one (FR-025), so the user never leaves the selected
  theme to get high contrast, and standard-contrast values are never used. If the selected theme is
  invalid, FB-001 chooses the theme to apply, and that theme's high-contrast mode is used.
- **FB-005**: User preference value invalid or outside the effective constraints: that entry is
  clamped (range values) or falls back to the point's documented default (discrete values and
  malformed values) per FR-044, other entries still apply, a diagnostic identifies clamping or
  fallback, and the stored preference is left unchanged.
- **FB-006**: User preference that refers to a customization point that no longer exists or is no
  longer permitted: skipped with a diagnostic.
- **FB-007**: User preference that would violate the policy's accessibility floor: rejected, so the
  point's documented default applies with a diagnostic; the stored preference is left unchanged,
  and the theme otherwise applies.
- **FB-008**: Resource limit exceeded: rejected with bounded effort; no partial results are used.
- **FB-009**: Forbidden content: the whole theme is rejected; diagnostics give the location without
  reproducing the content in an interpretable form.
- **FB-010**: Identifier collision with a trusted theme: the untrusted theme is treated as distinct,
  never replaces the trusted one, and is flagged.
- **FB-011**: Deprecated elements: the theme is valid, and warnings name the replacement.
- **FB-012**: Styling for undeclared contracts or unknown extension namespaces: ignored without
  error.
- **FB-013**: The specification baseline theme is part of the specification and is always valid,
  so a host is never left without a valid presentation.

### Product Boundaries and Out of Scope

- OpenTheme is not a page builder, a business-logic framework, an application state manager, or an
  authentication or payment system. A theme changes how an application is presented, never what it
  does.
- The specification is application- and domain-agnostic. It contains no concepts from any
  particular domain or consumer; Nisha-specific concepts MUST NOT be introduced.
- Out of scope for this feature. Each is a later feature that must conform to this specification:
  - the runtime engine, output targets, and framework adapters (including React);
  - the Customization Policy document format and the User Preferences document format;
  - the theme package container format; package-level import and export; sharing flows;
    marketplace distribution; and personalization product UX (theme pickers, Theme Builder);
  - designer ecosystem services and any AI service;
  - tooling for developer theme authoring.

  In scope for this feature (document-level readiness for later packaging and sharing):
  canonical form and integrity; flattening a theme inheritance chain into one self-contained
  document; export-eligibility checks (author, license, integrity); and lossless round-trip
  verification of theme documents. These are not package-container or product-UX flows.

### Key Entities *(include if feature involves data)*

- **Theme Specification**: The versioned contract (normative rules plus machine-readable schema)
  that defines what a theme can express and how it is validated and resolved.
- **Theme**: A declarative document conforming to the specification: metadata, tokens, mode values,
  component and layout styling, and customization points.
- **Theme Metadata**: Identity (identifier, version), display text (name, description,
  localizations), attribution (author, license), provenance (origin, lineage), and compatibility
  (specification version, contract versions, supported modes, base theme).
- **Token**: A named, typed presentation value. Primitive tokens are internal to a theme; semantic
  tokens are named by role and consumed by hosts.
- **Token Reference**: A token whose value is another token's value, resolved after all precedence
  layers are applied.
- **Derived Value / Transformation**: A token value computed from other token values by one of the
  specification's finite, deterministic, typed transformations (e.g., color mixing, lightness
  adjustment, contrast-aware selection, scaling), also resolved after all layers are applied.
- **Standard Semantic Baseline**: The domain-neutral set of semantic tokens that makes themes
  portable, split into seed tokens and tokens with specification defaults.
- **Seed Token**: One of the few baseline tokens every theme must define (background, foreground,
  and accent colors per supported color scheme, and a primary font family). Specification defaults
  derive the rest of the baseline from the seeds.
- **Context Dimension**: An axis along which values vary: color scheme, contrast, motion, density,
  and size class. A mode is a value on the color-scheme and contrast dimensions.
- **Component Contract**: A versioned, appearance-only declaration of a styleable element: parts,
  states, variants, properties, defaults, and contrast pairs. Standard contracts come from the
  specification; extension contracts come from hosts, in their own namespaces.
- **Layout Variant**: A host-implemented alternative presentation of a region (e.g., navigation
  placement) that a theme may select per size class.
- **Customization Point**: A theme's declaration of a user-adjustable property, with its type,
  constraints, labels, and default. Standard points have well-known identifiers shared by themes.
- **Base Theme**: A theme that another theme extends; together they form an inheritance chain.
- **Extension Namespace**: A named area for host or third-party additions that implementations
  preserve but do not interpret.
- **Specification Baseline Theme**: The always-valid, accessible fallback theme that is part of the
  specification.
- **Reference Theme**: A production-quality official prebuilt theme delivered with the
  specification. It is shippable to end users and also serves as a normative example and test
  subject for adoption and portability.
- **Reference Host Declaration**: A generic, domain-neutral host declaration used to demonstrate
  and test adoption and portability.
- **Resolution Context**: The inputs to resolution: selected theme, context dimension values, user
  preferences, developer policy, and platform accessibility preferences.
- **Resolved Theme**: The complete set of concrete values produced for one resolution context.
- **Diagnostic**: A structured finding with a stable code, severity, location, message, remediation
  hint, and rule reference.
- **Conformance Suite**: Fixtures and resolution examples, with expected outcomes, that define
  conforming behavior.
- **Customization Policy** *(format defined in a later feature)*: The developer's declaration of
  available themes, permitted customization, locks, and protected tokens.
- **User Preferences** *(format defined in a later feature)*: An end user's selections and
  overrides, stored separately from any theme and never modified by resolution or constraint
  enforcement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Using only the reference themes and a reference host declaration, a developer can
  offer at least two complete themes while authoring zero theme values, and 100% of consumed values
  resolve in every supported mode.
- **SC-002**: Every reference theme applies to both reference host declarations with no edits,
  giving 100% coverage of standard tokens and standard contracts, and host extension contracts
  resolve from their defaults.
- **SC-003**: 100% of malicious fixtures (at least one per forbidden-content category and per
  resource limit) are rejected, and across the full invalid-fixture set there are zero cases of
  partial application.
- **SC-004**: Two independently developed validators agree on validity and diagnostic codes for 100%
  of fixtures, and on resolved values for 100% of resolution examples. This is a **cross-feature
  release gate**: this feature MUST deliver the conformance protocol, fixtures, runner, and
  reference checker that make the measurement possible; agreement with an independently developed
  production-core implementation is verified when that later feature passes the same suite. This
  feature alone does not complete SC-004.
- **SC-005**: 100% of invalid fixtures produce diagnostics with a code, location, and remediation
  hint, and in a review test, reviewers identify the correct fix from the diagnostics alone for at
  least 90% of fixtures.
- **SC-006**: For the specification baseline theme and every reference theme: 100% of declared
  pairs meet WCAG 2.2 AA in every mode and the enhanced thresholds in high-contrast modes; 100% of
  semantic color roles map to a forced-colors role; 100% of motion tokens have reduced-motion
  values; and zero interactive parts fall below the minimum target size at any density.
- **SC-007**: At least 80% of five or more designers or front-end developers who are new to
  OpenTheme, using only the published specification and examples, produce a valid seed-only theme
  within 15 minutes and a valid theme supporting light, dark, and high contrast within 30 minutes.
- **SC-008**: Given only the machine-readable specification and examples, at least 90% of 100 or
  more generation attempts across at least two different AI models produce a valid theme on the
  first attempt, and at least 99% do so after one correction round that uses only the diagnostics.
- **SC-009**: 100% of resolution examples have exactly one documented expected result, and
  reviewers who read only the specification predict the result correctly for at least 95% of them.
- **SC-010**: A conforming validator validates a typical theme within 100 ms, and a theme at the
  resource limits within 1 second, on a mid-range consumer phone.
- **SC-011**: 100% of valid fixtures survive export and re-import with an identical canonical form
  and integrity hash, extension data included.
- **SC-012**: An independent review finds zero domain-specific terms in the specification
  vocabulary and zero specification fields capable of expressing behavior, content, data access,
  or network activity.
- **SC-013**: When any later 1.x version is drafted, 100% of fixtures valid under earlier 1.x
  versions remain valid and resolve equivalently.
- **SC-014**: For a sample of at least 1,000 accent colors spread across the sRGB gamut, each
  reference theme derives every accent-related token from the single chosen color, 100% of derived
  text-on-accent pairs meet WCAG 2.2 AA, and every other declared pair either meets AA or the accent
  is rejected with a diagnostic; no pair is ever applied below AA.
- **SC-015**: For seed-only fixtures with at least 1,000 seed combinations spread across the sRGB
  gamut whose seed pairs meet AA, 100% resolve completely in every declared mode, 100% of
  default-derived pairs meet WCAG 2.2 AA, and 100% of pairs in high-contrast modes meet the
  enhanced thresholds.

## Assumptions

- This feature produces the specification and its conformance artifacts, not running software.
  Verification tooling for those artifacts is the private reference checker and conformance runner
  (research R18). The production core is a later feature.
- The Customization Policy and User Preferences formats are separate follow-up features. They must
  follow the precedence model defined here and refer to customization points and tokens by their
  stable identifiers and paths.
- The theme package container, package-level import/export, sharing product flows, and marketplace
  are follow-up features. This feature makes theme *documents* ready for them through the
  canonical form, integrity hash, self-contained flatten/export eligibility, and provenance
  (see Out of Scope; US7; research R3).
- "Trusted" means bundled by the developer at build time; everything else is untrusted, as the
  constitution defines.
- Resource limits are those confirmed in research R15 (including document size 1 MiB; 10,000
  tokens; reference chain depth 16; derivation composition depth 8; structural nesting depth 16;
  inheritance depth 4; 200 customization points; display names up to 100 characters and
  descriptions up to 1,000; motion durations up to 1,000 ms; and at most 200 diagnostics per
  validation pass), plus the additional structural limits listed there.
- The transformation set (FR-018) is the closed set in research R9. Color computation uses OKLab
  with CSS Color 4 gamut mapping and fixed quantization (research R6); numeric kernels are in
  research R7 so every implementation computes identical values.
- The seed set (FR-016) is fixed for 1.x. Specification-default formulas are those in research R10.
  Status colors (success, warning, danger, info), which cannot be inferred from the accent, default
  to specification-defined hues adjusted for contrast against the background seed.
- WCAG 2.2 AA is the accessibility baseline, using its contrast algorithm (research R8). Newer
  contrast models (e.g., from WCAG 3 drafts) may be added in a later minor version.
- "CSS pixels" is the reference measure for WCAG size thresholds; non-web platforms map it to their
  equivalent unit.
- Size classes are the three tiers `compact`, `medium`, and `expanded` with specification-default
  thresholds in the context-dimensions registry (research R11; contracts/registries.md).
- Themes that target a newer minor version are rejected rather than partly used. This preserves
  determinism and the never-partially-applied rule, at the cost of requiring newer implementations
  for newer features.
- Themes cannot reference external assets in 1.x. Fonts are referenced by name, and a missing font
  is handled by fallbacks.
- The standard component catalog covers the seven families named in FR-030 as the fourteen
  contracts listed in research R17. Parts, states, variants, properties, pairs, and defaults are
  defined in the component catalog registry.
- Theme identifiers use lowercase reverse-domain notation, with the `uid.` form for authors without
  a domain (research R5).
- Applying different themes to different regions of one application is a runtime concern; the
  specification does not preclude it.
- The specification text is published under the project's open license, which is still to be
  selected (constitution TODO(LICENSE); research R21).
- Reference host declarations are generic, domain-neutral examples. No real consumer, including
  Nisha, shapes the specification.
