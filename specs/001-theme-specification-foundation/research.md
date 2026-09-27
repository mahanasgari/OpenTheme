# Research: Theme Specification and Theme Foundation

**Feature**: `001-theme-specification-foundation` | **Date**: 2026-09-25 | **Plan**: [plan.md](./plan.md)

This document resolves every open technical question in the plan's Technical Context and every item
the specification defers to planning ("finalized in planning", "decided in planning", "to be
confirmed in planning"). Each entry records the decision, why it was chosen, and what else was
considered. Normative detail (exact algorithms, constants, and full vocabularies) is written during
implementation in the normative specification; these decisions bound that work.

---

## R1. Interchange representation

- **Decision**: A theme is a single JSON document restricted to I-JSON (RFC 7493): UTF-8 without a
  byte-order mark, no duplicate member names, no unpaired surrogates, and numbers representable as
  IEEE 754 binary64. The recommended file suffix is `.opentheme.json`; the proposed media type is
  `application/vnd.opentheme.theme+json`, with `application/json` also accepted. Host declarations
  use the same rules with the suffix `.opentheme-host.json`.
- **Rationale**: JSON is readable by every language and platform (FR-001, NFR-005), is the base of
  the W3C Design Tokens format (FR-096), and has mature schema tooling. I-JSON removes the parts of
  JSON that make validity implementation-dependent: duplicate keys, lone surrogates, and big
  numbers (NFR-001).
- **Alternatives considered**: YAML (more readable, but it has several parsing modes, implicit
  typing, and anchors and aliases that enable expansion attacks); JSON5 and TOML (less universal
  support and no benefit for machine producers); a binary format (not human-reviewable).

## R2. Machine-readable schema dialect

- **Decision**: JSON Schema draft 2020-12 for all schemas. Custom annotations use only `x-`
  prefixed keywords (e.g., `x-opentheme-rule`, `x-opentheme-code`), and schemas avoid
  vocabularies and `$dynamicRef`, so they migrate cleanly to JSON Schema v1/2026 once mainstream
  validators support it.
- **Rationale**: JSON Schema v1/2026 is now the first stable JSON Schema release, but Ajv 8.20 (the
  most widely used JavaScript validator) and many other implementations support only drafts
  through 2020-12. Implementers in other languages need a dialect they can validate today
  (NFR-009). Using `x-` keywords already follows v1's rule for unknown keywords.
- **Alternatives considered**: v1/2026 now (limited validator support); JSON Type Definition (RFC
  8927; too weak for unions, patterns, and ranges); a custom schema language (no ecosystem).
- **Consequence**: The schema describes structure and value grammar. Rules it cannot express
  (references, cycles, derivations, contrast, inheritance, resolution) are normative prose rules
  covered by conformance fixtures (FR-002).

## R3. Canonical form and integrity hash

- **Decision**: Canonical form = parse as I-JSON, apply the specification's normalization rules,
  then serialize with the JSON Canonicalization Scheme (JCS, RFC 8785). The normalization rules
  cover semantic equivalences that JCS alone does not: removing members whose value equals the
  documented implicit default (e.g., color `alpha: 1`), converting color `hex` to `components`
  when both are absent or only `hex` is given, and removing the `integrity` member itself. The
  integrity hash is SHA-256 over the canonical UTF-8 bytes, written as `sha256-` followed by
  standard base64 (the Subresource Integrity convention).
- **Rationale**: JCS is a published, language-neutral canonicalization with implementations in many
  languages, and it defines number serialization precisely (FR-069, SC-011). Explicit
  normalization rules make "semantically identical" a closed, testable list rather than a
  judgment.
- **Alternatives considered**: Hashing the raw bytes (formatting changes would change the hash);
  a custom canonical serializer (reinvents JCS); normalizing everything, e.g., converting all
  colors to one space (lossy and surprising to authors).

## R4. Token syntax and alignment with the W3C Design Tokens format

- **Decision**: Tokens follow the Design Tokens Format Module 2025.10 shape: groups of tokens with
  `$type`, `$value`, `$description`, `$deprecated`, and `$extensions`, and curly-brace aliases
  (`{color.surface.base}`) that target whole tokens. OpenTheme adds `$derive` (a derivation
  object, mutually exclusive with `$value`) and a context overlay mechanism (R11). In 1.0,
  OpenTheme does not support DTCG group `$extends` (inheritance is theme-level, FR-046),
  JSON Pointer `$ref` into token sub-properties, or `$root` tokens. Supported types: `color`,
  `dimension` (unit `px`, the reference pixel), `fontFamily`, `fontWeight`, `number`, `opacity`,
  `duration` (unit `ms`), `cubicBezier`, `strokeStyle` (named styles only), `border`, `shadow`,
  `typography`, and `density`.
- **Rationale**: Alignment makes the FR-096 mapping mostly one-to-one and lets DTCG tools read
  OpenTheme primitives. Leaving out sub-property references and group extension removes a second
  inheritance system and keeps reference resolution to one well-defined graph (NFR-001). A single
  dimension unit avoids `rem` semantics, which differ by platform. Text scaling is a resolution
  input instead (R11).
- **Alternatives considered**: Adopting DTCG verbatim (no derivations, no context model, and
  permissive extension points); an unrelated custom syntax (loses interoperability and designer
  familiarity).

## R5. Identifier syntax

- **Decision**: Theme and host identifiers use lowercase reverse-domain notation:
  `^[a-z][a-z0-9-]{0,62}(\.[a-z0-9][a-z0-9-]{0,62}){1,7}$`, at most 128 characters (e.g.,
  `org.opentheme.aurora`). Authors without a domain use the reserved prefix `uid.` followed by 26
  lowercase base32 characters from a random 128-bit value (e.g., `uid.k7q2...`). The prefixes
  `org.opentheme.` and `uid.` are reserved, and so is the standard namespace `std` for contracts
  and customization points.
- **Rationale**: Reverse-domain names are minted without a registry by anyone who controls a
  domain (FR-004) and read clearly. The `uid.` form serves end users who create themes on a
  device.
- **Alternatives considered**: URLs (look like network addresses, conflicting with FR-066); UUIDs
  only (unreadable); a central registry (violates FR-004 and Principle XII).

## R6. Color model, gamut mapping, and output quantization

- **Decision**:
  - Color literals use the DTCG color object with `colorSpace` `srgb` or `oklch` and optional
    `alpha` (default 1).
  - All transformations compute in OKLab, handling OKLCH lightness, chroma, and hue as operations
    on OKLab coordinates. Chroma scaling multiplies `a` and `b`, and hue rotation rotates them, so
    no arc-tangent is needed.
  - Out-of-gamut results are mapped to sRGB with the CSS Color Module Level 4 gamut-mapping
    algorithm (chroma reduction in OKLCH with a just-noticeable-difference test), using fixed
    loop bounds.
  - Every resolved color is quantized to sRGB with 8-bit channels (round half to even on
    channel × 255). Alpha is quantized to multiples of 0.001.
  - Contrast and every other accessibility check run on the quantized values, which are the values
    hosts actually render.
- **Rationale**: OKLab/OKLCH is perceptually uniform, which makes derived hover, pressed, and subtle
  surfaces look predictable across hues (the spec's assumption asked for a perceptual space).
  Chroma and hue operations without trigonometric inversion reduce the number of numeric kernels
  (R7). Quantizing before checking guarantees that the checked contrast is the rendered contrast.
- **Alternatives considered**: HSL (not perceptual; hue-dependent lightness); CIELAB/LCH (hue
  shifts in blues); Display P3 output (not universally renderable; can be added in 1.x as an
  additional output precision without changing checks).

## R7. Numeric determinism across implementations

- **Decision**: The normative computation model is IEEE 754 binary64 using only correctly rounded
  basic operations (+, −, ×, ÷, square root). Fused multiply-add contraction and extended
  precision are forbidden. Non-elementary functions come from **normative numeric kernels** that
  the specification defines using only those operations, fixed iteration counts, fixed
  polynomial coefficients, and exact power-of-two range reduction:
  - cube root (OKLab conversion);
  - the sRGB transfer function and its inverse (via log2 and exp2 kernels);
  - sine and cosine (hue rotation).
  Each kernel ships with golden vectors: exact inputs and outputs written as hexadecimal
  binary64. Implementations MUST NOT substitute platform math libraries.
- **Rationale**: NFR-001, FR-018, and SC-004 require identical results everywhere, including at
  contrast thresholds. Platform `pow`, `cbrt`, `sin`, and `cos` are not correctly rounded in all
  languages and can differ in the last bit, which can flip a quantized channel or a 4.5:1
  threshold. Kernels built from basic operations are bit-identical in every language that
  implements IEEE 754.
- **Alternatives considered**: Platform math plus tolerance (breaks "exactly one result"); integer
  fixed-point arithmetic (deterministic but much harder to specify and read); requiring
  correctly rounded math libraries (few languages ship them).
- **Verification**: Golden vectors in the conformance suite, and an independent Python
  re-implementation of the kernels that must reproduce the TypeScript reference bit for bit
  (plan: `tools/kernel-crosscheck`).

## R8. Contrast evaluation

- **Decision**:
  - Contrast is the WCAG 2.2 contrast ratio computed exactly, with no rounding before comparison,
    so 4.499 fails 4.5. It uses relative luminance with the sRGB linearization threshold 0.04045.
    That threshold gives the same results as the older 0.03928 for all 8-bit values.
  - Translucent colors are composited (source-over) onto the pair's declared backdrop before the
    check.
  - A text pair uses the large-text threshold only if it is declared for a typography role whose
    unscaled size meets WCAG's large-text definition (at least 24 px regular, or 18.66 px at
    weight 700 or more). Text scaling only enlarges text, so this is conservative.
  - Distinguishable role pairs (FR-073) use OKLab Euclidean distance. The warning threshold is a
    registry constant, initially 0.10, calibrated while authoring the reference themes.
- **Rationale**: This is the algorithm WCAG 2.2 AA conformance is judged by. Composited evaluation
  is required by FR-073, and exact comparison is required for determinism.
- **Alternatives considered**: APCA / WCAG 3 draft contrast (not a published recommendation; the
  spec's assumptions allow it as a later minor addition).

## R9. The transformation set (finalizes FR-018)

- **Decision**: 1.0 defines exactly these transformations. Full signatures, domains, and
  algorithms are in [contracts/transformations.md](./contracts/transformations.md).

  | Identifier | Purpose |
  |---|---|
  | `color.mix` | Interpolate two colors in OKLab (premultiplied alpha) by a ratio in [0, 1] |
  | `color.lightness` | Add a delta in [−1, 1] to OKLab lightness, clamped to [0, 1] |
  | `color.chroma` | Multiply chroma by a factor in [0, 4] |
  | `color.hue` | Rotate hue by degrees in [−360, 360] |
  | `color.alpha` | Set alpha to a value in [0, 1] |
  | `color.composite` | Composite a translucent color onto an opaque backdrop |
  | `color.contrast-select` | First of 1–8 candidates meeting a target contrast against 1–4 backgrounds, else the most legible |
  | `color.contrast-adjust` | Move lightness until a target contrast against 1–4 backgrounds is met, else the most legible achievable |
  | `color.mix-bounded` | Mix toward a color, stopping where contrast against a reference would fall below a minimum |
  | `number.scale`, `dimension.scale` | Multiply by a factor |
  | `number.add`, `dimension.add` | Add a delta |
  | `number.clamp`, `dimension.clamp` | Clamp to [min, max] |
  | `dimension.round` | Round to a multiple of a step (e.g., whole pixels) |

  Compositions nest by using a derivation object as an operand, up to the depth limit of 8.
  Derivations read only token values and literal operands. Context dimensions influence
  derivations only through context overlays; no transformation reads the context directly.
- **Rationale**: This is the smallest set that covers the clarified use cases: arbitrary accents,
  hover, pressed, and disabled states, text on accent, lighter and darker variants, borders,
  subtle surfaces, seed-derived baseline defaults, and high-contrast derivation. `mix-bounded` is
  what lets elevated dark-mode surfaces lighten without breaking text contrast.
  `contrast-adjust` always reaches 4.5:1 against a single opaque background, because black or
  white reaches at least 4.58:1 against any color, which is what makes the FR-016 guarantees
  provable.
- **Alternatives considered**: Generic arithmetic expressions (forbidden by FR-018 and FR-066);
  CSS `color-mix()` and relative color syntax (a styling language, and its functions are
  unbounded); a larger set with saturation and "tint/shade" aliases (redundant with `mix` and
  `chroma`).

## R10. Seed-based specification defaults (implements FR-016, FR-025, FR-027)

- **Decision**:
  - **Where defaults live**: every non-seed baseline token has a specification default stored in
    the normative registry `semantic-baseline.json` as a literal, an alias, or a derivation.
  - **Default formulas**:
    - Standard contrast:
      - Surfaces use `color.mix-bounded` from the background seed.
      - Secondary and disabled text use `color.mix` toward the background, followed by
        `color.contrast-adjust` against every surface they are paired with.
      - Accent-derived tokens use `color.lightness`, `color.mix`, and `color.contrast-select` or
        `color.contrast-adjust` against their declared pairs.
      - Status colors start from fixed registry hues and are adjusted for contrast against the
        background seed.
    - High contrast: a separate set of defaults. They reference only the seeds and other tokens'
      high-contrast values, never a theme's standard-contrast values. That is what "from the
      seeds alone" means in FR-016. Because references are late-bound, an author's high-contrast
      override (e.g., a white primary action) flows into the defaults that depend on it (e.g., the
      text on that action). The surfaces are the background seed pushed to its scheme's extreme
      luminance, the foreground is pushed to the opposite extreme, and every other color uses
      `color.contrast-adjust` or `color.contrast-select` with the enhanced targets (7:1 for
      text, 3:1 for non-text) against the high-contrast values it is paired with.
    - Motion: durations have a reduced-motion default of 0 ms. Non-color defaults are literals
      or scale derivations, e.g., radius tokens are derived from the `radius.factor` token that
      the corner-roundness point targets.
  - **Proof obligations** (each checked by a sweep test):
    - (a) For every AA-valid seed combination, every default-derived standard pair meets AA.
    - (b) For every valid seed combination, every high-contrast pair meets FR-027.
  - **Sampling**:
    - Accents (SC-014): 1,000 colors from a 10 × 10 × 10 grid of the sRGB cube.
    - Seed combinations (SC-015): each grid background is paired with the first AA-valid
      foreground in a fixed grid order, and each pair is combined with 4 accents, giving at least
      1,000 combinations.
  - **If a formula fails a sweep**: the formula changes. The seed-validity rule does not.
- **Rationale**: This makes the clarified guarantees ("seeds only", "always a conforming
  high-contrast mode") mechanically checkable rather than aspirational. Grid samples are
  reproducible without storing thousands of fixtures.
- **Alternatives considered**: Random sampling (reproducible only with a fixed generator, and less
  clearly "spread across the gamut"); storing every sample as a fixture (large and redundant).

## R11. Context model (modes and dimensions)

- **Decision**:
  - **Seeds**: seeds are declared per color scheme in a `seeds` block. They become the reserved
    tokens `seed.background`, `seed.foreground`, and `seed.accent` (per scheme) and
    `seed.font-family`.
  - **Overlays**: context-dependent values are declared in ordered `contexts` overlays, each with a
    `when` condition over the standard dimensions: `colorScheme`, `contrast`, `motion`, `density`,
    and `sizeClass`.
  - **Overlay precedence**: overlays apply in ascending specificity (the number of conditions).
    Among equally specific overlays, a fixed dimension priority decides: contrast, then color
    scheme, then density, then size class, then motion. Two overlays with identical conditions are
    invalid.
  - **High contrast**: color-typed values come only from overlays whose condition includes
    `contrast: high`, or else from the high-contrast specification defaults. Theme colors not
    declared for high contrast are not used in high contrast. Non-color tokens cascade normally.
    This implements "author values are used where declared, and the rest are seed-derived".
  - **Forced colors**: every color resolves to a system color role identifier (e.g., `canvas`,
    `canvas-text`, `link`, `button-face`) from the registry mapping, instead of a concrete color.
  - **Reduced motion**: every motion duration resolves to its reduced-motion value.
  - **Text scaling**: effective scale = max(platform factor, clamp(platform factor × in-app
    factor, allowed minimum, allowed maximum)), where the in-app factor is at least 1 and the
    allowed maximum is at least 2 (FR-020). It multiplies every `fontSize` and every dimension
    line height. Unitless line heights are unchanged.
  - **Target size**: interactive part sizes resolve to at least 24 px at every density. A lower
    theme value is raised to 24 px with an accessibility diagnostic (FR-075).
  - **Color scheme choice**: user choice, then platform, then developer default, limited to what is
    allowed and supported (FR-053). If none remains, the theme's declared default scheme is used
    (FB-003).
- **Rationale**: Overlays keep documents readable (one block per mode), map directly to the DTCG
  Resolver Module's modifiers for export, and give one deterministic precedence rule (FR-056).
  The high-contrast sourcing rule is the only way to honor the clarified "author high-contrast
  values used; everything else derived" without letting standard-contrast colors leak into
  high contrast.
- **Alternatives considered**: Per-token mode maps (`$value` keyed by mode; verbose, and hard to
  review for high contrast as a whole); separate files per mode (breaks "single document",
  FR-001); arbitrary conditions (forbidden by FR-066).

## R12. Resolution algorithm structure (refines FR-050 through FR-058)

- **Decision**: Resolution is a pure function (inputs in
  [contracts/resolution.md](./contracts/resolution.md)) with these stages:
  1. Select the theme, applying trust and identity rules (FR-068) and the fallback chain (FB-001).
     Inheritance is flattened base-first.
  2. Compute the effective context: color scheme per FR-053. Platform requests for high
     contrast, reduced motion, and forced colors are always honored (FR-052).
  3. Build a single declaration per token and contract property, from lowest to highest layer:
     specification and host contract defaults, then the theme chain (overlays per R11), then
     user values for effective customization points (after FR-044 enforcement), then policy
     locks and protected values.
  4. Evaluate the declaration graph in topological order (Kahn's algorithm). Ties are broken by
     canonical path order, so evaluation order, effort accounting, and the first reported
     diagnostic are identical everywhere. Locked tokens hold their locked value, so their
     dependents see it (US1 scenario 3).
  5. Post-process: effective text scale, target-size floor, forced colors, reduced motion.
  6. Quantize (R6).
  7. Run accessibility checks per mode (FR-064). The policy's accessibility floor then rejects
     every user value that a failing pair depends on (FB-007). A rejection re-runs stages 3 to 7
     once with those values at their documented defaults. The resulting values were already
     checked when the theme was validated, so one re-run is enough. Whether a theme with its own
     accessibility shortfalls may be used at all is a policy decision (FR-064).
- **Same-layer rule (FR-056)**: when several customization points target one token, the point
  declared last in the theme wins. Array order is preserved by the canonical form, so the rule
  is stable and visible to the author.
- **Rationale**: A single declaration graph evaluated once makes late binding (FR-055) and
  completeness (FR-057) straightforward, and it bounds effort by the token count.
- **Alternatives considered**: Resolving each layer fully and then merging (breaks late binding);
  iterating until values stop changing (unbounded).

## R13. Diagnostics

- **Decision**:
  - **Codes**: `OT-<AREA>-<NNN>` (e.g., `OT-REF-002`). Areas: `DOC`, `META`, `TOK`, `REF`,
    `DRV`, `CTX`, `CMP`, `LAY`, `CUS`, `INH`, `LIM`, `SEC`, `A11Y`, `VER`, `HOST`, `RES`.
  - **Fields**: severity (`error`, `warning`, `info`), location as a JSON Pointer (RFC 6901), a
    message template id with parameters, a remediation hint id, the violated rule id, and
    optional related locations.
  - **Registry**: every code is listed in `diagnostics.json` with English message and hint
    templates.
  - **Untrusted text**: parameters contain only grammar-constrained values (paths, codes, numbers,
    type names), never free text from the document (FR-071).
- **Rationale**: Stable codes and pointers let tools and AI correct themes from diagnostics alone
  (FR-093, SC-005). Template ids keep messages localizable. Refusing to echo free text rules out
  injection through diagnostics.
- **Alternatives considered**: Free-form messages (not stable); echoing offending values in
  sanitized form (still a risk for display surfaces).

## R14. Parsing and untrusted-input hardening

- **Decision**: The specification requires implementations to reject oversized input before
  parsing: byte length greater than 1 MiB fails immediately. Parsing is bounded, with nesting
  depth checked during tokenization, and duplicate member names are detected. Member names that
  collide with object prototypes carry no special meaning. The reference checker uses its own
  I-JSON tokenizer for this (the platform `JSON.parse` silently accepts duplicate keys and cannot
  enforce limits during parsing). Parsing code falls under the constitution's security-review
  requirement.
- **Rationale**: FR-063 requires bounded effort for any input, including input far beyond the
  limits (SC-003). Principle VI requires malicious fixtures and a security review for parsing
  code.
- **Alternatives considered**: `JSON.parse` followed by checks (unbounded work before any limit
  applies, and duplicates are silently lost).

## R15. Resource limits (confirms the spec's assumptions)

- **Decision**: The spec's initial limits are confirmed:
  - document size 1 MiB; 10,000 tokens;
  - reference chain depth 16; derivation composition depth 8; structural nesting depth 16;
  - inheritance depth 4; 200 customization points;
  - display names 100 characters, descriptions 1,000; motion durations up to 1,000 ms;
  - 200 diagnostics per pass.

  Added structural limits:
  - 64 context overlays; 128 styled contracts; 64 localized variants;
  - 16 targets per customization point; 8 candidates and 4 backgrounds per contrast
    transformation;
  - 256 characters per token path, 64 per path segment;
  - 16 variant axes per contract.

  **Derivation effort** is measured in units per resolution of one mode: 1 unit per basic
  transformation, 12 for `color.contrast-select`, and 48 for `color.contrast-adjust` and
  `color.mix-bounded`. The budget is 200,000 units per mode, and validation checks each declared
  mode against it.
- **Rationale**: Fixed limits make validity universal (FR-062). The effort model is simple enough to
  count exactly, and it keeps an at-limit theme within the 1-second phone budget (NFR-003): about
  8 modes × 200,000 units, each unit well under a microsecond.
- **Alternatives considered**: Time-based limits (not deterministic); per-implementation limits
  (forbidden by FR-062).

## R16. Versioning and migration

- **Decision**:
  - **Spec versions**: pre-releases are `1.0.0-draft.N`, with no compatibility guarantee (FR-079).
  - **Targeted version**: themes declare it as `"opentheme": "MAJOR.MINOR"`. Patch versions
    never affect validity.
  - **Migrations**: they are data, a migration manifest of declarative operations (rename path,
    move member, map enumeration value, drop member with a lossy diagnostic), applied in
    order. This makes them deterministic and testable (FR-082).
  - **Testing migration**: because 1.0 has no predecessor, the conformance suite includes a
    test-only "simulated previous major" profile with its own manifest (US6 scenario 3).
  - **Theme changes**: breaking theme changes (FR-084) are classified by a normative comparison
    procedure over two theme versions.
- **Rationale**: Declarative migrations satisfy Principle IX's automated migration requirement
  without executable code in the specification.
- **Alternatives considered**: Code-based migrators per implementation (not portable or
  verifiable).

## R17. Standard component catalog scope (confirms the spec's assumption)

- **Decision**: 1.0 ships these standard contracts:
  - `std/button`, `std/icon-button`;
  - `std/text-input`, `std/checkbox`, `std/radio`, `std/switch`, `std/select`;
  - `std/form-field`;
  - `std/card`;
  - `std/nav-bar`, `std/menu`, `std/tabs`;
  - `std/table`;
  - `std/dialog`.

  This covers the seven families in FR-030. Parts, states, variants, properties, pairs, and
  defaults are listed in the registry. The contract shape is in
  [data-model.md](./data-model.md).
- **Rationale**: Each family has the variants common to nearly every UI, and more contracts can be
  added in minor versions (additive).
- **Alternatives considered**: A broader catalog (toasts, tooltips, badges, lists); this is
  deferred to 1.x to keep the first conformance surface reviewable.

## R18. Tooling stack for the reference checker and verification

- **Decision**:
  - **Language and runtime**: TypeScript 6.0 on Node.js 24 LTS; CI also runs on Node.js 26, which
    becomes LTS on 2026-10-28. pnpm workspaces.
  - **Libraries**: Ajv 8 (draft 2020-12) evaluates the schema, and every schema constraint
    carries an `x-opentheme-code` annotation so schema failures map to stable diagnostic codes.
    Vitest for tests, with fast-check for property tests of transformations (totality,
    determinism, domains).
  - **Code quality**: Biome for formatting and linting; markdownlint for specification prose.
  - **Types**: generated from the schemas with json-schema-to-typescript (Principle XI).
  - **Kernel cross-check**: Python 3.13, standard library only.
  - **Portability**: the reference checker library uses no Node-specific APIs, so it also runs in
    browsers for phone benchmarks. Only its CLI uses Node.
- **Rationale**: This is a mainstream toolchain for the future TypeScript core, typed from the
  schema, with a second language only where determinism must be proven.
- **Alternatives considered**: Writing the reference checker in Rust or Python (fewer future
  contributors in the adapter ecosystem); no reference checker (fixture outcomes, accessibility
  sweeps, and SC-006 could not be verified mechanically).
- **Boundary**: The reference checker is non-normative, private, and not a supported runtime.
  The production core is a later feature developed independently against the specification, so
  SC-004 compares two genuinely independent implementations through the conformance runner
  protocol.

## R19. W3C Design Tokens mapping (FR-096)

- **Decision**: Export produces one DTCG 2025.10 document per requested mode, with every derived
  value computed for that mode. The derivation source is kept in
  `$extensions["org.opentheme"]` for lossless round trips. Import maps DTCG tokens to primitives
  or, by name mapping, to semantic tokens. The mapping chapter documents what does not map:
  derivations, overlays (and their optional mapping to DTCG Resolver Module modifiers), component
  contracts, customization points, and `rem` dimensions.
- **Rationale**: Computed export is what the spec suggests and what DTCG consumers can use today.

## R20. Validating human and AI success criteria

- **Decision**: `evaluations/` holds protocols and scoring scripts for criteria that need people or
  models:
  - SC-005, reviewers fix themes from diagnostics alone;
  - SC-007, designer authoring timing;
  - SC-008, AI generation: 100 attempts across two or more model providers through a
    provider-agnostic script;
  - SC-009, reviewers predict resolution results;
  - SC-012, independent vocabulary review, backed by an automated domain-term scan.
  These evaluations run manually before the 1.0.0 release. They are not part of CI and are never
  a dependency of any package (Principles VII and XII).
- **Rationale**: These criteria are about human or model behavior and cannot be unit tests. Written
  protocols make the results reproducible and auditable.

## R21. Licensing (constitution TODO(LICENSE))

- **Decision**: Not decided in this plan. The design only requires that licenses be SPDX
  expressions (FR-007). Choosing the project license (code and specification text, and the license
  of the reference and prebuilt themes) is a maintainer decision and a **release gate** for
  1.0.0. Until then, reference themes carry `LicenseRef-OpenTheme-Pending`, which the release
  checklist rejects.
- **Rationale**: A license choice is governance, not design. Recording a placeholder keeps the
  fixtures valid and makes the gap impossible to ship.

## R22. Performance validation (NFR-003, SC-010; Principle VIII budgets)

- **Decision**: Budgets are measured on the reference checker as a proxy for "the specification
  allows it". A CI x86-64 runner is taken as about 4 times faster than a mid-range phone:
  - validate and resolve a typical theme (1,000 tokens): median 25 ms or less;
  - an at-limit theme: 250 ms or less;
  - rejection of a 10 MiB document: 5 ms or less (size check before parsing);
  - re-resolution after a context change: 4 ms or less.
  Before release, the browser build of the benchmark runs on a named mid-range Android reference
  device to confirm 100 ms and 1 s directly. Production-core budgets and bundle size budgets
  belong to the runtime feature.
- **Rationale**: This satisfies Principle VIII (budgets defined and benchmarked in CI) without
  pretending the unoptimized reference checker is the product.
