---

description: "Task list for the Theme Specification and Theme Foundation"
---

# Tasks: Theme Specification and Theme Foundation

**Input**: Design documents from `/specs/001-theme-specification-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Mandatory. Constitution Principle X makes tests mandatory for the Theme Specification,
schemas, policy enforcement, migrations, and the untrusted-input pipeline, and it requires this task
list to include them regardless of template defaults (plan.md "Mandatory test coverage"). Most tests
here are conformance fixtures, which are the specification's expected outcomes. Write each story's
fixtures and unit tests first and confirm they fail before implementing the behavior they exercise.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified
independently after the Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1–US8)
- Every task names the exact files it creates or changes

## Path Conventions

- `specification/` holds the normative deliverables, `conformance/` the fixtures, sweeps, and
  runner, `tools/` the private non-normative tooling, and `evaluations/` the manual protocols
  (plan.md "Project Structure").
- Reference checker sources are in `tools/reference-checker/src/`, with tests in
  `tools/reference-checker/test/unit/` and `tools/reference-checker/test/property/`.
- A fixture's id is its path relative to `conformance/fixtures/` without `.json`. Every fixture
  names at least one rule in `rules` (NFR-010).
- Rule identifiers are `R-<AREA>-<NNN>`. Areas are the diagnostic areas (DOC, META, TOK, REF, DRV,
  CTX, CMP, LAY, CUS, INH, LIM, SEC, A11Y, VER, HOST, RES) plus KRN (numeric kernels), BAS
  (semantic baseline), and EXT (extensions, provenance, interchange).
- The specification version while drafting is `1.0.0-draft.1` (FR-079). Themes and hosts target
  `"opentheme": "1.0"` / `"openthemeHost": "1.0"`.
- Official theme identifiers: `org.opentheme.baseline`, `org.opentheme.aurora`, and
  `org.opentheme.graphite`. Reference hosts: `com.example.notes` and `com.example.media`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workspace, tooling configuration, and CI entry point

- [x] T001 Create the repository skeleton from plan.md: `specification/{spec,schemas/1.0/defs,schemas/1.0/registry,registry/1.0,themes/baseline,themes/reference,hosts,examples}`, `conformance/{fixtures,sweeps,runner}`, `tools/{reference-checker,types,kernel-crosscheck,spec-lint,bench}`, and `evaluations/`, plus a root `.gitignore` (node_modules, dist, conformance/out, tools/bench/out) and `.editorconfig` (UTF-8, LF, final newline)
- [x] T002 Create root `package.json` (private, `engines.node` ">=24", pnpm 10 or later) and `pnpm-workspace.yaml` (packages `tools/*`, `conformance/runner`) with the scripts `build`, `test`, `spec:check`, `conformance`, `sweeps`, `kernels:crosscheck`, `bench`, `bench:browser`, `verify` (runs spec:check, test, conformance, sweeps, kernels:crosscheck, and bench in that order), and `release:check`, each delegating to the workspace package that owns it
- [x] T003 [P] Create `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, target ES2023, module and moduleResolution NodeNext, and `lib: ["ES2023"]` only (no DOM, so the reference checker library stays platform-neutral per research R18)
- [x] T004 [P] Create `biome.json`: formatter with 2-space indent and line width 100, recommended lint rules, `noExplicitAny` as an error, scoped to `tools/**` and `conformance/runner/**`
- [x] T005 [P] Create `.markdownlint-cli2.jsonc`: MD013 line length 100 with tables and code blocks excluded, applied to `specification/**/*.md`, `evaluations/**/*.md`, and `AGENTS.md`
- [x] T006 [P] Create root `vitest.config.ts` with projects for `tools/reference-checker`, `tools/spec-lint`, and `conformance/runner`, and add `vitest` and `fast-check` as root dev dependencies
- [x] T007 [P] Create `tools/reference-checker/package.json` (private, name `@opentheme/reference-checker`, bin `ot-ref` → `dist/cli/main.js`, `ajv` 8 as its only runtime dependency), `tools/reference-checker/tsconfig.json` extending the base, and an empty `tools/reference-checker/src/index.ts`
- [x] T008 [P] Create `conformance/runner/package.json` (private, name `@opentheme/conformance-runner`, bin `ot-conformance`), `conformance/runner/tsconfig.json`, and `conformance/runner/src/main.ts` (argument parsing only)
- [x] T009 [P] Create `package.json` and `tsconfig.json` for `tools/spec-lint` (dev dependency `markdownlint-cli2`), `tools/types` (dev dependency `json-schema-to-typescript`), and `tools/bench`, all private
- [x] T010 [P] Write root `AGENTS.md`: repository layout, every pnpm command, and the invariants contributors and agents must keep (the specification is normative and the reference checker is not; no platform math in kernels, color, or transforms; no network access; diagnostic codes only from `diagnostics.json`; fixture naming and `rules`; 100-character prose lines; changes under `tools/reference-checker/src/parse/` need a recorded security review)
- [x] T011 [P] Add the CI workflow `.github/workflows/ci.yml` (or the chosen provider's equivalent) with a Node.js 24 and 26 matrix and Python 3.13 that runs only `pnpm install --frozen-lockfile` and `pnpm verify`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core vocabulary (schemas, registries, and normative chapters) plus the reference
checker's parser, kernels, color model, transformations, validator, resolver core, conformance
runner, and specification linting. Every user story builds on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Registries and schemas

- [x] T012 [P] Write the registry schemas `specification/schemas/1.0/registry/{semantic-baseline,component-catalog,customization-points,context-dimensions,transformations,forced-colors,limits,diagnostics,rules}.schema.json` per contracts/registries.md. Every registry requires `version`, and every entry requires `description` and at least one `example` (FR-003, NFR-006)
- [x] T013 [P] Write `specification/registry/1.0/limits.json` with exactly: documentBytes 1048576, tokens 10000, referenceDepth 16, derivationDepth 8, nestingDepth 16, inheritanceDepth 4, customizationPoints 200, overlays 64, styledContracts 128, localizedVariants 64, pointTargets 16, contrastCandidates 8, contrastBackgrounds 4, pathLength 256, pathSegmentLength 64, variantAxes 16, displayNameLength 100, descriptionLength 1000, motionDurationMs 1000, diagnostics 200, and effortUnitsPerMode 200000. Also add keywords 16, keywordLength 32, lineageEntries 32, and fontFamilies 8 (from data-model §2 and §4). Each limit gets a description and an example (research R15)
- [x] T014 [P] Write `specification/registry/1.0/diagnostics.json` with every code in the contracts/diagnostics.md "Initial code catalog" (areas DOC, META, VER, TOK, REF, DRV, CTX, CMP, LAY, CUS, INH, LIM, A11Y, SEC, HOST, RES) and the listed severity. Give each code English `message` and `hint` templates whose placeholders use only the allowed params (token paths, contract and point identifiers, codes, numbers, type names, enumeration values, versions; FR-071), plus empty `rules` and `fixtures` arrays
- [x] T015 [P] Write `specification/registry/1.0/context-dimensions.json` exactly as in contracts/registries.md: priority `["contrast","colorScheme","density","sizeClass","motion"]`, the five dimensions and their values, density default `standard`, and sizeClass thresholds medium 600 px and expanded 1024 px, with descriptions and examples
- [x] T016 [P] Write `specification/registry/1.0/forced-colors.json` with the nine roles `canvas`, `canvas-text`, `link-text`, `button-face`, `button-text`, `highlight`, `highlight-text`, `gray-text`, and `button-border`. Give each a description and its non-normative CSS system-color hint (Canvas, CanvasText, LinkText, ButtonFace, ButtonText, Highlight, HighlightText, GrayText, ButtonBorder)
- [x] T017 [P] Write `specification/registry/1.0/transformations.json` with the 16 operations from contracts/transformations.md: arguments (name, type, domain, optional), output type, effort cost (1 each; `color.contrast-select` 12; `color.contrast-adjust` and `color.mix-bounded` 48), description, and example
- [x] T018 [P] Create `specification/registry/1.0/rules.json` as `{ "version": "1.0.0-draft.1", "rules": [] }` and set `version` to `1.0.0-draft.1` in every registry file
- [x] T019 [P] Write `specification/schemas/1.0/diagnostic.schema.json` per contracts/diagnostics.md:
  - `code` matches `^OT-[A-Z0-9]+-[0-9]{3}$`;
  - `severity` is one of `error`, `warning`, `info`;
  - `location.document` is `theme`, `base:<id>@<version>`, `host`, or `input`, and `location.pointer` is an RFC 6901 pointer;
  - `rule` matches `^R-[A-Z0-9]+-[0-9]{3}$`;
  - `message` and `hint` are template ids;
  - `params` values are limited to the grammar-constrained kinds;
  - `related` is an optional list of locations
- [x] T020 [P] Write `specification/schemas/1.0/fixture.schema.json` per data-model §18 and contracts/conformance.md:
  - `kind` is `validate`, `resolve`, `canonicalize`, `flatten`, `compare-versions`, `migrate`, or `kernel`;
  - `rules` has at least one item, with `description`;
  - `input` may use `{ "$file": … }` restricted to `conformance/fixtures/**` and `specification/{themes,hosts,examples}/**`, and `input.generate` with the generators `pad-bytes`, `nest-depth`, `token-count`, `reference-chain`, `derivation-depth`, and `repeat-member`;
  - `expect` members are defined per kind;
  - `profile` is optional
- [x] T021 [P] Write `specification/schemas/1.0/resolution-input.schema.json` and `specification/schemas/1.0/resolved-theme.schema.json` per data-model §14–§15 and contracts/resolution.md:
  - `platform`: `colorScheme` is `light`, `dark`, or `no-preference`; `contrast` is `standard` or `high`; `forcedColors` is a boolean; `reducedMotion` is a boolean; `textScale` is a number greater than 0;
  - `environment`: `sizeClass`, `locale` (a BCP 47 tag), and `direction` (`ltr` or `rtl`);
  - `policy` members: `availableThemes`, `defaultTheme`, `permittedPoints`, `allowedColorSchemes`, `locks`, `protected`, and `accessibilityFloor` (`wcag22-aa` or `relaxed`);
  - `applied.fallback` is `none`, `previous`, `developer-default`, or `specification-baseline`;
  - each preference status is `effective`, `clamped`, `fell-back`, `skipped`, or `rejected`;
  - a resolved color is `{ srgb8: [3 integers 0–255], alpha }` with alpha a multiple of 0.001, or `{ system: <forced-color role> }`
- [x] T022 [P] Write `specification/schemas/1.0/defs/display-text.schema.json` and `specification/schemas/1.0/defs/metadata.schema.json` per data-model §2, quoting its constraints:
  - `id`: reverse-domain, `^[a-z][a-z0-9-]{0,62}(\.[a-z0-9][a-z0-9-]{0,62}){1,7}$`, at most 128 characters, or `uid.` followed by 26 lowercase base32 characters;
  - `version`: "Semantic version 2.0.0 string";
  - `name`: "Plain text, 1 to 100 characters";
  - `description`: "Optional plain text, up to 1,000 characters";
  - `keywords`: "up to 16 plain-text items of up to 32 characters each";
  - `localized`: "map from a BCP 47 language tag to `{ name?, description? }`; at most 64 entries";
  - `author`: `{ name }` in plain text, with no URLs or email addresses (NFR-008);
  - `license`: an SPDX license expression;
  - `provenance.origin`: one of `specification-baseline`, `prebuilt`, `developer-authored`, `user-created`, `imported`, `ai-generated`, `ai-assisted`;
  - `provenance.lineage`: an "Ordered list of `{ id, version }` … up to 32 entries";
  - `compatibility.catalog`: MAJOR.MINOR;
  - `compatibility.extensions`: a map from namespace to version;
  - display text "must not contain C0 or C1 control characters, bidirectional embedding, override, or isolate controls (U+202A–U+202E, U+2066–U+2069), or noncharacters", while U+200E, U+200F, and U+061C are allowed.

  Annotate every constraint with `x-opentheme-code` and `x-opentheme-rule`, and mark display-text strings with `x-opentheme-display-text: true`
- [x] T023 [P] Write `specification/schemas/1.0/defs/seeds.schema.json` per data-model §3:
  - `colorSchemes.supported`: a "Non-empty set drawn from `light`, `dark`, and declared variants";
  - `colorSchemes.default`: "One of `supported`";
  - `colorSchemes.variants`: a map from variant name to `{ fallback: "light" | "dark" }`;
  - `seeds.<scheme>.background`, `seeds.<scheme>.foreground`, and `seeds.<scheme>.accent`: colors;
  - `seeds.<variant>.*`: optional;
  - `seeds.fontFamily`: a font family list ending in a generic family.

  Seed opacity and cross-member rules are validator rules, not schema rules
- [x] T024 [P] Write `specification/schemas/1.0/defs/tokens.schema.json` per data-model §4 and research R4:
  - path segments match `[a-z][a-z0-9-]*`, with "at most 64 characters per segment and 256 in total", and host paths are qualified as `<host-namespace>/<local path>`;
  - reserved members are `$type`, `$value`, `$derive`, `$description`, `$deprecated`, and `$extensions`, and exactly one of `$value` or `$derive` is present;
  - aliases are strings of the form `{path}`;
  - literal grammars (all quoted from the data-model table):
    - `color` is `{ colorSpace: "srgb" | "oklch", components: [3 numbers in range], alpha?: 0..1, hex?: "#rrggbb" }`;
    - `dimension` is `{ value: number, unit: "px" }`;
    - `fontFamily` is an "Array of 1 to 8 family names, ending in a generic family", optionally keyed by script;
    - `fontWeight` is an "Integer 1 to 1000";
    - `number` is finite;
    - `opacity` is 0 to 1;
    - `duration` is `{ value: 0..1000, unit: "ms" }`;
    - `cubicBezier` is `[x1, y1, x2, y2]` "with x values in [0, 1]";
    - `strokeStyle` is `solid`, `dashed`, or `dotted`;
    - `border`, `shadow`, and `typography` are composites, whose members may carry `physical: true`;
    - `density` is `compact`, `standard`, or `comfortable`;
  - family names match a family-name grammar of letters, digits, spaces, `-`, `_`, and `.`, 1 to 64 characters, so URLs, styling text, and markup cannot be expressed (FR-066, FR-067);
  - generic families form the closed list `serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`, `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`, `math`, `emoji`, and `fangsong`;
  - colors are sRGB or OKLCH with translucency (FR-021), and font families are ordered fallback lists, optionally per script (FR-022, NFR-007)
- [x] T025 [P] Write `specification/schemas/1.0/defs/derivation.schema.json` per data-model §5: `$derive: { op, args }`, where `op` is one of the 16 identifiers in `transformations.json` and each `args` operand is a literal, an alias, or a nested derivation. Nesting depth, operand types, and domains are validator rules
- [x] T026 [P] Write `specification/schemas/1.0/defs/contexts.schema.json` per data-model §6:
  - `contexts` is an array of at most 64 overlays;
  - `when` is a "Non-empty map over the dimensions `colorScheme`, `contrast`, `motion`, `density`, `sizeClass`, each with one value from that dimension's closed set";
  - `tokens` holds partial token groups, and overlay tokens omit `$type`;
  - `components` holds partial component styling
- [x] T027 [P] Write `specification/schemas/1.0/defs/components.schema.json` per data-model §7 and contracts/theme-document.md:
  - keys are `std/<name>` or `<host-namespace>/<name>`, with at most 128 styled contracts;
  - `contract` is MAJOR.MINOR;
  - `parts.<part>.<property>` is a token value or `{ "$states": { <state>: value } }`;
  - `variants.<axis>.<value>.parts…` holds variant-specific part styling;
  - there are no members for content, labels, or bindings (FR-034)
- [x] T028 [P] Write `specification/schemas/1.0/defs/customization.schema.json` per data-model §9, quoting its constraints:
  - `points`: an array of at most 200 points;
  - `id`: "`std.<name>` for standard points … or a theme-local identifier `[a-z][a-z0-9-]*`";
  - `label` and `description`: plain text with `localized` variants;
  - `target`: "1 to 16 token paths, or one context dimension (`colorScheme`, `contrast`, `motion`, `density`)";
  - `type`: "A token type, or `enum` for dimension targets";
  - `constraints`: "Exactly one of: `range { min, max, step }` for numbers and dimensions; `range { gamut: "srgb", opaque: true }` for colors …; `enum [values]`; or `presets [{ id, label, value }]`", where a preset value is a literal or an alias, never a derivation;
  - `default`: an optional literal, or a preset id for preset points;
  - `effectiveRange`: "Text-size point only: `{ min, max }` for the effective text scale, with `max ≥ 2`"
- [x] T029 Write `specification/schemas/1.0/theme.schema.json` composing the defs from T022–T028 (contracts/theme-document.md "Top-level shape"):
  - required members: `opentheme` (pattern `^[0-9]+\.[0-9]+$`, so version support is reported as VER codes, not schema errors), `id`, `version`, `name`, `provenance.origin`, `compatibility.catalog`, `colorSchemes`, and `seeds`;
  - optional members: `description`, `keywords`, `localized`, `author`, `license`, `tokens`, `contexts`, `components`, `customization`, and `$extensions`;
  - `additionalProperties: false` maps to `OT-DOC-003`;
  - `extends`, `layout`, and `integrity` are added by US2, US5, and US7
- [x] T030 Write `tools/types/scripts/generate.ts`, which generates `tools/types/src/generated/*.ts` from every schema under `specification/schemas/1.0/`. Wire it into `pnpm build`, and add a check to `pnpm spec:check` that fails when the generated files are stale (Principle XI)

### Normative chapters (foundational sections)

- [x] T031 [P] Write `specification/spec/00-introduction-and-conformance.md`: scope and product boundaries, constitution terminology, conformance classes (*validator*: validate, canonicalize, kernel; *resolver*: all kinds), RFC 2119 language, version `1.0.0-draft.1`, the relationship between prose, schemas, registries, and fixtures, and the non-normative status of the reference checker
- [x] T032 [P] Write `specification/spec/01-document-format.md` (encoding and parsing sections):
  - I-JSON (RFC 7493) and UTF-8 without a BOM;
  - the 1,048,576-byte check before parsing;
  - nesting depth 16, duplicate member names, and lone surrogates;
  - binary64-representable numbers;
  - member names with no special meaning;
  - the suffixes `.opentheme.json` and `.opentheme-host.json`, and the media type;
  - unknown members outside `$extensions` are errors;
  - a theme is one self-describing document (FR-001; research R1, R14)
- [x] T033 [P] Write `specification/spec/02-metadata-and-identity.md`: identifier grammar and reserved prefixes (R5), theme versioning (FR-004, FR-005), display text rules (FR-011), localization lookup using RFC 4647 "lookup" (exact tag, then shorter tags, then the default), attribution and license (FR-007), provenance that is informational only (FR-008, FR-010), and compatibility (FR-009)
- [x] T034 [P] Write `specification/spec/03-tokens.md`: the closed type set and grammars (FR-012, FR-013), paths and reserved groups (FR-019), primitive versus semantic tokens (FR-014), aliases and type compatibility (FR-017), deprecation markers (FR-023), logical versus physical values (FR-077), the reference graph, cycles (including through derivations), and reference depth 16
- [x] T035 [P] Write `specification/spec/04-transformations.md` from contracts/transformations.md:
  - common rules and the 16 operations;
  - algorithms A1 and A2 with exactly 32 bisection iterations;
  - domains, with validation evaluating derivations in every declared mode;
  - `OT-DRV-004`, `OT-DRV-101`, and `OT-DRV-102`;
  - effort costs and the per-mode budget of 200,000 units;
  - the FR-018 guarantees (FR-018, research R9)
- [x] T036 [P] Write `specification/spec/05-numeric-kernels.md`:
  - the computation model: IEEE 754 binary64 basic operations only, with no FMA and no extended precision;
  - kernel definitions for `cbrt`, `log2`, `exp2`, `srgb-decode`, `srgb-encode`, `sin`, and `cos`, each with exact range reduction, fixed polynomial degrees, and published binary64 coefficients (derive them offline, e.g., minimax fits, and publish each as hexadecimal binary64 plus a decimal value);
  - the CSS Color 4 OKLab matrices as binary64 constants;
  - gamut mapping with a JND of 0.02, a clip step, and exactly 24 iterations;
  - quantization: round-half-even(clamp(c, 0, 1) × 255) / 255, with alpha as round-half-even(alpha × 1000) / 1000;
  - conformance by bit-exact golden vectors (research R6, R7)
- [x] T037 [P] Write `specification/spec/06-contexts-and-modes.md`: the five dimensions (FR-024), supported schemes and the default scheme (FR-025), variants and their fallback (FR-026), overlays and their validation, precedence (ascending specificity, then contrast > colorScheme > density > sizeClass > motion; FR-056), the high-contrast color sourcing rule, and "high contrast never moves the user" (FB-004; research R11)
- [x] T038 [P] Write `specification/spec/07-semantic-baseline-and-defaults.md`:
  - the seeds and the reserved tokens `seed.background`, `seed.foreground`, `seed.accent`, and `seed.font-family`;
  - the baseline groups of FR-015;
  - default formulas for standard contrast;
  - high-contrast defaults that reference only seeds and high-contrast values and are late-bound;
  - reduced-motion defaults of 0 ms;
  - `radius.factor`;
  - the proof obligations (a) and (b) with their sweeps;
  - the registry is authoritative (FR-016, FR-028, research R10)
- [x] T039 [P] Write the components sections of `specification/spec/08-components-and-layout.md`:
  - contract structure: parts, states limited to "Subset of `default`, `hover`, `focus-visible`, `pressed`, `disabled`, `selected`, `invalid`", variants, properties limited to R4 types, defaults as aliases to standard tokens, pairs, and `interactiveParts`;
  - theme styling rules, including `$states` and variants (FR-033, FR-034);
  - applicability: unknown or incompatible contracts are ignored with `OT-CMP-001` or `OT-CMP-002`, and this is not partial application (FR-032, FR-065);
  - a summary of the standard catalog (FR-029, FR-030)
- [x] T040 [P] Write the declaration and enforcement sections of `specification/spec/09-customization-points.md`:
  - point fields and constraint kinds;
  - the documented default ("this value or, if absent, the theme's own value of the target in the active context");
  - standard points opted into by id, with narrowing only;
  - the FR-042 consistency rules, including "`(max − min) / step` is an integer" and a text-size `min` of at least 1;
  - the single FR-044 enforcement rule:
    - clamp to the nearest boundary;
    - snap to the nearest step, with ties to the lower value;
    - color out of gamut: gamut-map, with alpha forced to 1;
    - a disallowed discrete value or a malformed value: the documented default;
    - distinct codes `OT-CUS-101` and `OT-CUS-102`;
    - the stored value is never modified;
  - the same-layer rule: the last-declared point wins (FR-040–FR-042, FR-044, FR-056)
- [x] T041 [P] Write the core of `specification/spec/10-inheritance-and-resolution.md`:
  - resolution as a pure function, and the abstract input model (it is not the Policy or Preferences format);
  - stages 1–7 from contracts/resolution.md:
    - select, with the fallback chain previous → developer default → specification baseline (FB-001, FB-013);
    - context from the platform and the policy default;
    - declare layers 1 and 2;
    - evaluate with Kahn's algorithm, breaking ties by canonical path order;
    - quantize;
    - check;
  - completeness (FR-057) and JCS-serialized output;
  - the precedence layers of FR-050, with the sections for locks, inheritance, and the user layer added by US1, US2, and US4
- [x] T042 [P] Write the core sections of `specification/spec/11-accessibility.md`:
  - exact WCAG 2.2 contrast on quantized sRGB with threshold 0.04045, with no rounding before comparison;
  - pair kinds `text`, `large-text`, `non-text`, and `disabled`, and the large-text rule "at least 24 px regular, or 18.66 px at weight 700 or more";
  - composited evaluation against the declared backdrop;
  - the disabled exemption;
  - distinguishable pairs by OKLab distance, with threshold 0.10;
  - validity rules: the seed pair must meet 4.5:1 (FR-059), and each high-contrast mode must meet 7:1 (4.5:1 for large text) and 3:1 for non-text (FR-027);
  - focus tokens must never resolve to alpha 0 or a width below 1 px (FR-074);
  - a per-mode accessibility report kept separate from validity (FR-064; research R8)
- [x] T043 [P] Write the limits and parsing sections of `specification/spec/12-security-and-limits.md`: the fixed limits table (cite `limits.json`; FR-062), the effort model, the size check before parsing, bounded effort for any input (FR-063, NFR-002), and an invalid document is never partially applied (FR-065)
- [x] T044 [P] Write `specification/spec/13-diagnostics.md` from contracts/diagnostics.md:
  - the diagnostic object;
  - severity and validity (FR-060);
  - one pass over every error (FR-061);
  - ordering: document, then canonical pointer, then code;
  - the cap of 200 plus `OT-LIM-099`;
  - literal-only params (FR-071);
  - template localization;
  - the registry is authoritative (FR-093)

### Registry content (depends on the chapters above)

- [x] T045 Write the color tokens in `specification/registry/1.0/semantic-baseline.json` (depends on T012, T038):
  - groups: surfaces (`color.surface.base`, `raised`, `sunken`, `overlay`), text (`color.text.primary`, `secondary`, `disabled`, `on-action`, `on-status`), borders and dividers, primary and secondary actions (background, hover, pressed, disabled, text), links, focus color, selection, scrim, and status `success`, `warning`, `danger`, and `info`, each with foreground and background;
  - each token has a `type`, `description`, `example`, `default` (research R10 formulas), `highContrastDefault` (seeds and high-contrast values only), and `forcedColor` role
- [x] T046 Add the non-color tokens to `specification/registry/1.0/semantic-baseline.json` (depends on T045):
  - reserved `seed.*` entries;
  - `font.family.*` roles;
  - typography roles `text.body`, `text.heading-1` to `text.heading-4`, `text.label`, `text.caption`, and `text.monospace`;
  - the `space.*` scale;
  - `size.*`, including `size.target.min` = 24 px;
  - `radius.factor` and a `radius.*` scale derived from it;
  - `border.width.*`;
  - `elevation.*` shadows;
  - `opacity.*` roles;
  - `motion.duration.*`, each with a reduced-motion default of 0 ms, and `motion.easing.*`;
  - `breakpoint.medium` (600 px) and `breakpoint.expanded` (1024 px);
  - `layout.container.max-width`, `layout.content.max-width`, `layout.gutter`, `layout.grid.columns`, `layout.region.spacing`, and `layout.alignment`
- [x] T047 Add `pairs` and `distinguishable` to `specification/registry/1.0/semantic-baseline.json` (depends on T046):
  - text on every surface;
  - text on actions;
  - status foreground on background;
  - non-text pairs for control boundaries and the focus indicator against adjacent surfaces;
  - `disabled` pairs explicitly marked;
  - distinguishable pairs, at least danger versus primary action, with `distinguishableThreshold` 0.10 (FR-072, FR-073)
- [x] T048 Write `specification/registry/1.0/component-catalog.json` with the 14 contracts of research R17: `std/button`, `std/icon-button`, `std/text-input`, `std/checkbox`, `std/radio`, `std/switch`, `std/select`, `std/form-field`, `std/card`, `std/nav-bar`, `std/menu`, `std/tabs`, `std/table`, and `std/dialog`. Each has parts, states, variants (e.g., button `emphasis` primary/secondary/tertiary/danger and `size` sm/md/lg), typed properties, a default for every property that aliases a baseline token, pairs, and `interactiveParts` (depends on T039 and T047)
- [x] T049 [P] Write `specification/registry/1.0/customization-points.json` with the seven standard points of data-model §9 (depends on T012 and T040):
  - `std.accent` targets `seed.accent` in every scheme, with `range { gamut: "srgb", opaque: true }`;
  - `std.color-scheme` has enum `[light, dark]`;
  - `std.contrast` has enum `[standard, high]`;
  - `std.text-size` targets the in-app factor, with range min 1, max 2, step 0.05 and `effectiveRange` min 1, max 3;
  - `std.density` has enum `[compact, standard, comfortable]`;
  - `std.corner-roundness` targets `radius.factor`, with range min 0, max 2, step 0.05;
  - `std.motion` has enum `[standard, reduced]`;
  - each point has labels, descriptions, localization keys, and an example

### Reference checker core

- [x] T050 [P] Write parser tests in `tools/reference-checker/test/unit/parse/ijson.test.ts` and `tools/reference-checker/test/property/parse.property.test.ts`:
  - unit cases:
    - a BOM is rejected;
    - a duplicate member gives `OT-DOC-002` at the second occurrence;
    - a lone surrogate is rejected;
    - nesting depth 17 gives `OT-LIM-002`;
    - more than 1,048,576 bytes gives `OT-LIM-001` before any tokenizing;
    - a number outside the binary64 range is rejected;
    - `__proto__` is treated as an ordinary member;
  - property tests with arbitrary bytes: the parser never throws and does linear work
- [x] T051 Implement `tools/reference-checker/src/parse/ijson.ts` and `tools/reference-checker/src/parse/index.ts`: a bounded I-JSON tokenizer with no `JSON.parse`, producing null-prototype nodes with JSON Pointers. The size check runs before tokenizing and the depth check runs during tokenizing (depends on T050; research R14)
- [x] T052 [P] Write `tools/reference-checker/test/unit/diagnostics/collector.test.ts`:
  - ordering by document (theme, bases nearest to farthest, host, input), then pointer in canonical order, then code;
  - the cap of 200 followed by `OT-LIM-099` with the omitted count;
  - params of any other kind than the allowed kinds are rejected
- [x] T053 Implement `tools/reference-checker/src/diagnostics/collector.ts` and `tools/reference-checker/src/diagnostics/registry.ts`. Codes come only from `diagnostics.json`, and an unknown code is an internal error (exit code 4) (depends on T014 and T052)
- [x] T054 Implement `tools/reference-checker/src/registry/load.ts`: load every registry, validate it against its registry schema with Ajv 2020-12, and expose typed accessors from `tools/types` (depends on T012–T018 and T030)
- [x] T055 [P] Write `tools/reference-checker/test/unit/schema/validate.test.ts`: every Ajv failure maps to the `x-opentheme-code` of the failing keyword, and to its pointer (an unknown member gives `OT-DOC-003`, a wrong type `OT-DOC-004`, a missing member `OT-DOC-005`)
- [x] T056 Implement `tools/reference-checker/src/schema/validate.ts`: compile `theme.schema.json` and its defs with Ajv 2020 using `allErrors`, and map errors to diagnostics through the annotations (depends on T029, T053, and T055)
- [x] T057 [P] Implement `tools/reference-checker/src/canonical/jcs.ts` (an RFC 8785 serializer) with `tools/reference-checker/test/unit/canonical/jcs.test.ts` using the RFC 8785 test vectors
- [x] T058 [P] Write `tools/reference-checker/test/unit/kernels/kernels.test.ts`, which replays every vector in `conformance/fixtures/kernels/*.json`, and `tools/reference-checker/test/unit/no-platform-math.test.ts`, which fails if `tools/reference-checker/src/{kernels,color,transforms}/**` uses `Math.pow`, `cbrt`, `sin`, `cos`, `tan`, `log`, `log2`, `log10`, `exp`, `expm1`, `hypot`, `atan2`, `fround`, `round`, or the `**` operator (research R7). The same test fails if `tools/reference-checker/src/**` uses `fetch`, `node:http`, `node:https`, `node:net`, `XMLHttpRequest`, or `WebSocket` (NFR-004, Principle XII)
- [x] T059 Implement `tools/reference-checker/src/kernels/{hex64,cbrt,log2-exp2,srgb-transfer,trig}.ts` exactly as specified in `05-numeric-kernels.md` (depends on T036 and T058)
- [x] T060 Write `tools/reference-checker/scripts/gen-kernel-vectors.ts`, which generates `conformance/fixtures/kernels/{cbrt,log2,exp2,srgb-decode,srgb-encode,sin,cos}.json`. Each file holds at least 1,000 `[function, inputHex, outputHex]` vectors, including ±0, subnormals, range-reduction edges, and the thresholds 0.04045 and 0.0031308, with kind `kernel` and `R-KRN-*` rules (depends on T020 and T059)
- [x] T061 Implement the independent Python 3.13 cross-check `tools/kernel-crosscheck/kernels.py` and `tools/kernel-crosscheck/crosscheck.py` from `05-numeric-kernels.md`, using the standard library only and `struct` for bit patterns. It compares every vector bit for bit, exits non-zero on any mismatch, and is wired to `pnpm kernels:crosscheck` (depends on T036 and T060)
- [x] T062 [P] Write color tests in `tools/reference-checker/test/unit/color/{oklab,gamut,quantize,contrast,composite}.test.ts`:
  - OKLab known values from CSS Color 4;
  - an out-of-gamut OKLCH color maps into gamut in at most 24 iterations;
  - 0.3 quantizes to 76 (round half even);
  - white on black is 21:1, and a 4.499 ratio fails 4.5;
  - source-over compositing in gamma-encoded sRGB
- [x] T063 Implement `tools/reference-checker/src/color/{oklab,oklch,gamut,quantize,contrast,composite}.ts`. OKLCH hue uses the kernel sine and cosine (depends on T059 and T062; research R6, R8)
- [x] T064 [P] Write transformation tests `tools/reference-checker/test/unit/transforms/{color,contrast,number}.test.ts` for all 16 operations, and `tools/reference-checker/test/property/transforms.property.test.ts` with fast-check:
  - A1: return the input when it already passes; choose the endpoint (darker on a tie); bisect exactly 32 iterations and return the passing probe closest to the input;
  - A2: return m(`ratio`), then `color` unchanged, then the largest passing t;
  - totality over each domain;
  - bit-identical determinism;
  - outputs stay in type and range;
  - `color.contrast-adjust` reaches every target of 4.5 or less against any single opaque background
- [x] T065 Implement `tools/reference-checker/src/transforms/{registry,color,contrast,number,effort}.ts` (depends on T017, T063, and T064):
  - signatures come from `transformations.json`;
  - effort is counted per mode, with `OT-DRV-007` over 200,000 units;
  - an out-of-domain operand at validation gives `OT-DRV-004`;
  - at resolution, a user-dependent operand is clamped with `OT-DRV-102`;
  - output is clamped to the registry range with `OT-DRV-101`
- [x] T066 [P] Write `tools/reference-checker/test/unit/tokens/graph.test.ts`:
  - aliases resolve;
  - a missing target gives `OT-REF-001`, and an incompatible type `OT-REF-002`;
  - a direct cycle or a cycle through a derivation gives `OT-REF-003`, with the members in `related`;
  - reference depth 17 gives `OT-REF-004`;
  - topological order breaks ties by canonical path order
- [x] T067 Implement `tools/reference-checker/src/tokens/{paths,types,graph}.ts`: the path grammar and qualified host paths, `$type` inheritance from the nearest ancestor group, literal grammars with registry ranges, and the declaration graph over aliases and derivation operands using Kahn's algorithm (depends on T024 and T066)
- [x] T068 [P] Write `tools/reference-checker/test/unit/validate/pipeline.test.ts`:
  - the contracts/theme-document.md minimal theme is valid;
  - a metadata-only theme gives `OT-TOK-010`;
  - `opentheme` "1.1" is unsupported with `OT-VER-002` stating "1.1", and "2.0" gives `OT-VER-001`;
  - dark declared with seeds for light only gives `OT-TOK-010`;
  - a translucent seed gives `OT-TOK-011`;
  - a seed pair below 4.5:1 gives `OT-A11Y-001`, with both seed pointers;
  - an author high-contrast value below FR-027 gives `OT-A11Y-002` per failing pair;
  - focus alpha 0 gives `OT-A11Y-005`;
  - five independent errors are all reported in one pass, in canonical order
- [x] T069 Implement `tools/reference-checker/src/validate/{document,metadata,seeds}.ts` (depends on T051, T053, T054, T056, and T068):
  - the pipeline: size, parse, schema, version gate, metadata, seeds, tokens, derivations, contexts, components, customization declarations, accessibility, and collect;
  - the version gate accepts only "1.0" (research R16);
  - the metadata and display text rules;
  - the seeds rules: every supported standard scheme has all three color seeds, the seeds are opaque, and the seed pair meets 4.5:1 after quantization
- [x] T070 Implement `tools/reference-checker/src/validate/{tokens,derivations,contexts}.ts` (depends on T065, T067, and T069):
  - token grammars and `OT-TOK-*`;
  - derivations evaluated in every declared mode (supported schemes × standard/high) with `OT-DRV-001`–`OT-DRV-007`;
  - overlays: duplicate `when` gives `OT-CTX-002`; an unknown dimension or value gives `OT-CTX-001`; an unsupported scheme gives `OT-CTX-003`; an undeclared token gives `OT-CTX-004`
- [x] T071 Implement `tools/reference-checker/src/validate/{components,customization,a11y}.ts` (depends on T048, T049, and T070):
  - components: an unknown part or property of a known contract gives `OT-CMP-003`; an undeclared state or variant gives `OT-CMP-004`; an unknown contract gives `OT-CMP-001` (info) and an incompatible one `OT-CMP-002` (info);
  - customization: the FR-042 checks give `OT-CUS-001` to `OT-CUS-006`;
  - accessibility: a report per mode; errors `OT-A11Y-001`, `OT-A11Y-002`, and `OT-A11Y-005`; warnings `OT-A11Y-003` and `OT-A11Y-004`
- [x] T072 [P] Write `tools/reference-checker/test/unit/resolve/enforce.test.ts` for the FR-044 rule:
  - range clamp, including 3 with max 2, which gives 2 and `OT-CUS-101`;
  - snapping between steps, with ties to the lower step;
  - a color out of gamut is gamut-mapped with alpha forced to 1;
  - a disallowed enum or preset value falls back to the documented default with `OT-CUS-102`;
  - a malformed value falls back with `OT-CUS-102`;
  - the input value object is never mutated
- [x] T073 Implement `tools/reference-checker/src/resolve/enforce.ts`: a pure function taking a value, the effective constraints, and the documented default, and returning `{ status, value, diagnostic }` (depends on T063 and T072)
- [x] T074 [P] Write `tools/reference-checker/test/unit/resolve/core.test.ts`:
  - a seed-only theme resolves completely: every baseline token and every catalog contract property, with no primitives, aliases, or derivations left;
  - the high-contrast sourcing rule: standard-contrast colors are never used in high contrast, and an author high-contrast primary action flows into `color.text.on-action`;
  - overlay precedence;
  - the fallback chain previous → developer default → baseline, with `applied.fallback`;
  - identical inputs produce identical JCS bytes (NFR-001)
- [x] T075 Implement `tools/reference-checker/src/resolve/{select,context}.ts` (depends on T069 and T074):
  - select: candidates from `availableThemes`; the selected theme is validated; the fallback chain with `OT-RES-001` to `OT-RES-003`; the specification baseline is always available (FB-013);
  - context:
    - color scheme from the platform, then the policy default, within `allowedColorSchemes` ∩ supported; otherwise the theme default with `OT-CTX-101`;
    - contrast is high when the platform requests it;
    - motion is reduced when the platform requests it;
    - density is the theme default;
    - `sizeClass` comes from the environment
- [x] T076 Implement `tools/reference-checker/src/resolve/{declare,evaluate,postprocess,quantize,check,index}.ts` (depends on T065, T067, T075):
  - declare: layer 1 is the specification defaults (the high-contrast defaults in high contrast) and the contract defaults; layer 2 is the theme, with overlays and the high-contrast sourcing rule;
  - evaluate: Kahn's algorithm with the effort budget;
  - postprocess: stage 5 as a pass-through, extended by US3 (platform) and US4 (user and target size);
  - quantize (research R6);
  - check: the accessibility report for the effective mode;
  - index: assemble output per `resolved-theme.schema.json`, with the default `displayText`, serialized with JCS
- [x] T077 Implement `tools/reference-checker/src/cli/main.ts`:
  - `ot-ref validate <theme> [--json]` and `ot-ref resolve <input.json> [--json]`, with `--base` and `--host` flags added in US2 and US5;
  - exit codes: 0 valid or success, 1 invalid, 2 unsupported, 3 usage error, 4 internal error;
  - JSON goes to stdout and human-readable text to stderr (Principle XI)
- [x] T078 Implement `tools/reference-checker/src/conformance/serve.ts` and the `ot-ref serve-conformance` command:
  - the NDJSON protocol from contracts/conformance.md: `hello` (protocol "1", `supports`), `request`, `response`, `unsupported`, and `bye`;
  - kinds `validate`, `resolve`, and `kernel`; the other kinds answer `unsupported` until their stories add them;
  - the protocol is open, so any implementation in any language can be tested (NFR-009; this feature's share of the SC-004 cross-feature gate)
- [x] T079 [P] Write `conformance/runner/test/compare.test.ts`: the ordered list of (code, location) pairs must match exactly, `resolve` results compare by JCS bytes, `subset: true` compares only the listed members, and kernel results must match bit for bit
- [x] T080 Implement `conformance/runner/src/{fixtures,generate,protocol,compare,report,main}.ts` (depends on T020, T021, T078, and T079):
  - fixture discovery and fixture-schema validation;
  - `$file` inputs and the `input.generate` generators;
  - spawn with a handshake and a 10 s per-request timeout;
  - comparison rules;
  - a summary plus JUnit XML in `conformance/out/`;
  - options `--impl`, `--filter`, `--verbose`, and `--report`;
  - invariants on every `resolve` result:
    - the output validates against the resolved-theme schema;
    - completeness: every standard token and every catalog or host contract property has a value (FR-057);
    - every diagnostic's severity, rule, and params agree with `diagnostics.json`
- [x] T081 Author `specification/themes/baseline/org.opentheme.baseline.opentheme.json`:
  - `opentheme` "1.0", version "1.0.0", `provenance.origin` "specification-baseline";
  - author "OpenTheme Project", license `LicenseRef-OpenTheme-Pending` (research R21);
  - light and dark schemes, default light;
  - neutral seeds that meet AA with margin, font family `["system-ui", "sans-serif"]`;
  - no tokens beyond the seeds;
  - all seven standard customization points declared (FB-013)
- [x] T082 [P] Write the foundational fixtures in `conformance/fixtures/valid/` and `conformance/fixtures/resolution/core/`:
  - `conformance/fixtures/valid/doc/minimal-seed-only.json` (the "Quiet Paper" document from contracts/theme-document.md);
  - `valid/doc/dark-only.json` and `valid/ctx/light-dark-overlays.json`;
  - `valid/baseline/baseline-theme.json` (via `$file`);
  - `resolution/core/seed-only-light-standard.json` and `resolution/core/seed-only-light-high.json`, each with a hand-checkable subset of the expected output;
  - every fixture names its rules
- [x] T083 Implement the SC-015 seed sweep in `conformance/sweeps/seeds.json` and `conformance/runner/src/sweeps/seeds.ts` (depends on T076 and T080):
  - `conformance/sweeps/seeds.json`: the R10 grid parameters, i.e., each 10 × 10 × 10 grid background paired with the first AA-valid foreground in fixed grid order, and each pair combined with 4 accents, giving at least 1,000 combinations, in every mode;
  - `conformance/runner/src/sweeps/seeds.ts`, which asserts complete resolution in every declared mode, every default-derived pair at AA or better, and every high-contrast pair meeting FR-027;
  - wire it to `pnpm sweeps`;
  - if the sweep fails, change the formula in `semantic-baseline.json`, never the seed-validity rule
- [x] T084 Implement `tools/spec-lint/src/{schemas,registries,consistency,examples,traceability,markdown,main}.ts` and wire them to `pnpm spec:check`:
  - schemas: meta-validate every schema against 2020-12, and every constraint keyword must carry `x-opentheme-code`;
  - registries: validate each registry, and every entry must have a description and an example;
  - consistency: every code, op id, token path, and rule anchor cited in a chapter exists;
  - examples: JSON code blocks tagged `opentheme` in chapters must validate, and blocks tagged `opentheme invalid` must produce the codes they state;
  - traceability: report only, at this stage;
  - markdown: run markdownlint-cli2
- [x] T085 Register every rule defined in chapters 00–13 so far in `specification/registry/1.0/rules.json` (chapter, requirements, fixtures), and fill `rules` and `fixtures` in `diagnostics.json` for the codes those fixtures produce (depends on T031–T044 and T082)

**Checkpoint**: Seed-only themes validate and resolve completely in every declared mode, the seed
sweep passes, the kernel cross-check passes, and `pnpm conformance` passes on the foundational
fixtures. User story work can begin.

---

## Phase 3: User Story 1 - Developer offers prebuilt themes without authoring one (Priority: P1) 🎯 MVP

**Goal**: Two production-quality reference themes, plus the baseline, that fully style any host
using the standard vocabulary. The developer policy can lock brand values.

**Independent Test**: Validate each reference theme and resolve it against the
`com.example.notes` reference host declaration in light and dark at standard and high contrast.
Every value that host consumes (standard tokens, catalog contracts, and its declared extensions)
must have exactly one concrete value, with zero theme values authored by the developer (US1
independent test and SC-001).

**Depends on**: Foundational. T086 also depends on T137 for the notes reference host file.

### Tests for User Story 1 ⚠️

> Write these fixtures first and confirm they fail before implementation.

- [x] T086 [US1] Write `conformance/fixtures/resolution/us1/complete-{aurora,graphite}-{light,dark}-{standard,high}.json` (8 fixtures; each theme via `$file`, host via `$file` to `specification/hosts/com.example.notes.opentheme-host.json`; depends on T137). Each expects `applied.fallback` "none", the completeness invariant for everything that host consumes, and a subset of hand-checked values (US1 scenario 1, SC-001)
- [x] T087 [P] [US1] Write `conformance/fixtures/resolution/us1/unstyled-contract-defaults.json`: a theme that styles no `std/card` resolves `std/card` properties to the specification defaults computed from its own semantic tokens, e.g., container background = its `color.surface.raised` (US1 scenario 2)
- [x] T088 [P] [US1] Write `conformance/fixtures/resolution/us1/policy-lock-brand.json`: `locks` sets `color.action.primary.background` to a brand color. It expects the locked value, `background-hover`, `background-pressed`, and `color.text.on-action` recomputed from it, and `color.surface.base` equal to the unlocked result. A second fixture, `policy-lock-contract.json`, locks one `std/button` corner-radius property through its contract property path and expects only that resolved property to change (US1 scenario 3, FR-051, FR-055, FR-070)
- [x] T089 [P] [US1] Write `conformance/fixtures/resolution/us1/default-missing.json` and `default-invalid.json`, which expect `applied.fallback` "specification-baseline" and `OT-RES-003`, and four baseline mode fixtures `resolution/us1/baseline-{light,dark}-{standard,high}.json`, whose accessibility reports all pass (US1 scenario 4)
- [x] T090 [P] [US1] Write `conformance/fixtures/valid/reference/{aurora,graphite}.json` (via `$file`) and `tools/spec-lint/src/official-themes.ts`, which checks every file under `specification/themes/{baseline,reference}/` for `id`, `name`, `version`, `author`, `license`, `provenance.origin` (prebuilt, or specification-baseline for the baseline), `opentheme`, `compatibility`, `colorSchemes.supported` ⊇ {light, dark}, an always-present high-contrast mode for each supported scheme that passes validation and FR-027 (FR-025, FR-099), and all seven standard points (US1 scenario 5, FR-025, FR-041, FR-099)
- [x] T091 [P] [US1] Write the layer-pair matrix fixtures `conformance/fixtures/resolution/matrix/L1-L2-*.json`, `L1-L4-*.json`, and `L2-L4-*.json`, one per dimension `colorScheme`, `contrast`, `motion`, `density`, and `sizeClass` (15 fixtures), each with exactly one expected result. Where a layer cannot affect a dimension, the fixture records the lower layer's value holding (FR-058)

### Implementation for User Story 1

- [x] T092 [US1] Implement layer 4 locks in `tools/reference-checker/src/resolve/policy.ts` and `tools/reference-checker/src/resolve/declare.ts`: `locks` maps a semantic token path, or a contract property path `components.<contract id>.parts.<part>.<property>`, to a literal checked against its type (a mistyped lock gives `OT-TOK-004` at `input` `/policy/locks/<path>`). Locked values are fixed inputs, so their dependents see them (FR-051, FR-055, FR-070)
- [x] T093 [P] [US1] Add the section "Developer policy: available themes, default theme, and locks" to `specification/spec/10-inheritance-and-resolution.md` (FR-050 layer 4, FR-051, FR-055, US1 scenario 3)
- [x] T094 [P] [US1] Author `specification/themes/reference/org.opentheme.aurora.opentheme.json`:
  - a cool, airy style: a near-white cool background, deep ink foreground, and blue-violet OKLCH accent in light, with matching dark seeds; font family `["Inter", "system-ui", "sans-serif"]`; `radius.factor` 1.5; comfortable spacing; soft elevation;
  - high-contrast overlays for action colors in both schemes;
  - styling for `std/button`, `std/card`, and `std/text-input`;
  - every accent-related token derived from `seed.accent` (FR-041);
  - all seven standard points;
  - provenance "prebuilt", author "OpenTheme Project", license `LicenseRef-OpenTheme-Pending`, `compatibility.catalog` "1.0"
- [x] T095 [P] [US1] Author `specification/themes/reference/org.opentheme.graphite.opentheme.json`:
  - a crisp, warm-neutral style distinct from Aurora (FR-099): grayscale seeds with an amber accent, `radius.factor` 0.25, borders instead of shadows, a tighter type scale;
  - high-contrast overlays;
  - styling for `std/table`, `std/tabs`, `std/nav-bar`, and `std/dialog`;
  - accent-related tokens derived from `seed.accent`;
  - all seven standard points;
  - the same metadata rules as T094
- [x] T096 [US1] Implement `conformance/runner/src/sweeps/official.ts` (the SC-006 official theme check, wired to `pnpm sweeps`). For the baseline and each reference theme it checks:
  - every baseline and catalog pair passes AA in every scheme at standard contrast, and FR-027 at high contrast;
  - every standard color token and catalog color property has a forced-color role;
  - every motion token has a reduced-motion value (depends on T094 and T095; FR-078, Principle VIII)
- [x] T097 [US1] Register the US1 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json` (e.g., `OT-RES-003`)

**Checkpoint**: The MVP. The reference themes and the baseline are valid, complete in every mode,
and AA-conformant. The US1 fixtures pass.

---

## Phase 4: User Story 2 - Invalid and unsafe themes are never applied (Priority: P1)

**Goal**: Malformed, unsupported, oversized, or unsafe themes are rejected as a whole with exact
diagnostics, while the application keeps a valid appearance.

**Independent Test**: `pnpm conformance --filter "malicious/**"` and
`pnpm conformance --filter "invalid/**"`. Every fixture is invalid with its exact codes and
locations, and the paired resolution fixtures show that nothing from a rejected theme is applied.

### Tests for User Story 2 ⚠️

- [x] T098 [P] [US2] Write malicious content fixtures in `conformance/fixtures/malicious/content/`, one or more per forbidden category (FR-066, FB-009), each asserting its exact code and location:
  - script (a `script` member gives `OT-DOC-003`; `"javascript:…"` in a token gives `OT-TOK-004`);
  - raw CSS text in `$value` (`OT-TOK-004`);
  - a selector member (`OT-DOC-003`);
  - a URL as a font family name (`OT-TOK-004`);
  - a condition outside the five dimensions in `when` (`OT-CTX-001`);
  - a data-access member (`OT-DOC-003`);
  - bidirectional override controls in `name` (`OT-META-004`).

  Also add `malicious/content/markup-in-name.json`, whose theme is *valid* and whose name is carried through as literal text (FR-011)
- [x] T099 [P] [US2] Write malicious limit fixtures in `conformance/fixtures/malicious/limits/`, one per limit, using `input.generate` (SC-003, FB-008):
  - 1,048,577 bytes and 10 MiB (`OT-LIM-001`, no parse);
  - nesting depth 17 and 100,000 (`OT-LIM-002`);
  - 10,001 tokens (`OT-LIM-003`);
  - 65 overlays (`OT-LIM-005`);
  - a path of 257 characters and a segment of 65 (`OT-LIM-006`);
  - reference chain 17 (`OT-REF-004`);
  - derivation depth 9 (`OT-DRV-005`);
  - the effort budget exceeded, e.g., 4,200 `color.contrast-adjust` operations (`OT-DRV-007`);
  - 129 styled contracts;
  - 65 localized variants;
  - 9 contrast candidates and 5 backgrounds;
  - a display name of 101 characters and a description of 1,001 (`OT-META-005`);
  - a motion duration of 1,001 ms;
  - 17 keywords, 33 lineage entries, and 9 font families;
  - a theme with more than 200 errors (200 diagnostics plus `OT-LIM-099`)
- [x] T100 [P] [US2] Write invalid fixtures in `conformance/fixtures/invalid/{doc,meta,tok,ref,drv,ctx,cmp,a11y,ver}/`:
  - broken references `OT-REF-001` and `OT-REF-002` (US2 scenario 2);
  - direct and through-derivation cycles `OT-REF-003`, with the members in `related` (scenario 3);
  - a newer minor, which is unsupported with `OT-VER-002` stating the required version, and an unsupported major `OT-VER-001` (scenario 5);
  - five independent errors in one document (scenario 6);
  - invalid derivations (scenario 9): unknown op `OT-DRV-001`; a free-form expression string as `$derive` `OT-DOC-004`; a wrong operand type `OT-DRV-003`; depth 9 `OT-DRV-005`; ratio 1.5 `OT-DRV-004`; an output type mismatch `OT-DRV-006`;
  - the spec edge cases:
    - metadata only (`OT-TOK-010`);
    - dark supported without dark seeds (`OT-TOK-010`);
    - a translucent seed (`OT-TOK-011`);
    - a seed pair below AA (`OT-A11Y-001`);
    - failing author high-contrast values (`OT-A11Y-002`);
    - an invisible focus indicator (`OT-A11Y-005`);
    - a duplicate member (`OT-DOC-002`);
    - an unknown member or unknown `$` member (`OT-DOC-003`);
    - a negative size or a duration over the maximum (`OT-TOK-005`);
    - overlay errors `OT-CTX-001` to `OT-CTX-004`;
    - component errors `OT-CMP-003` and `OT-CMP-004`;
    - metadata errors `OT-META-001` to `OT-META-007`
- [x] T101 [P] [US2] Write inheritance fixtures in `conformance/fixtures/inheritance/`:
  - a valid child that extends a base (base-first merge, overlays merged per `when`, a point narrowed);
  - a cycle through inheritance (`OT-INH-004`);
  - a missing base (`OT-INH-001`);
  - an invalid base (`OT-INH-002`);
  - a version outside the range (`OT-INH-003`);
  - depth 5 (`OT-INH-005`);
  - a child overriding a base token with a different type (`OT-TOK-006`);
  - a compatible base update that removes a token the child references (`OT-REF-001` located in the child) (FR-046, FR-047, edge cases)
- [x] T102 [P] [US2] Write resolution fixtures in `conformance/fixtures/resolution/us2/`:
  - `keep-previous.json`: theme A is applied and the user selects invalid B, so A stays in full, with `applied.fallback` "previous", `OT-RES-001`, B's validation errors, and no B values (scenario 7);
  - `base-missing.json` (FB-002);
  - `identity-collision.json`: an untrusted theme with a trusted theme's id is kept distinct, never replaces the trusted theme, and is flagged `OT-SEC-001` (scenario 8, FB-010);
  - `trust-propagation.json`: the child of a trusted base, supplied as untrusted, is untrusted (FR-048);
  - `limit-selected.json` and `forbidden-selected.json`: fallback with no partial values (FB-008, FB-009, FR-065)
- [x] T103 [P] [US2] Write `tools/reference-checker/test/property/bounded-effort.test.ts`: for random documents up to 10 MiB and pathological inputs (100,000-deep nesting, 100,000 duplicate keys, long alias chains), validation never throws, always returns diagnostics, and stays within a linear bound on tokenizer steps plus effort units (FR-063, NFR-002)

### Implementation for User Story 2

- [x] T104 [US2] Add the `extends` member `{ id, version }` to `specification/schemas/1.0/theme.schema.json`, where `version` is "an exact version or a caret range `^M.m.p`" (data-model §10), and regenerate `tools/types`
- [x] T105 [US2] Implement `tools/reference-checker/src/validate/inheritance.ts` and the `--base <file>` CLI flag in `tools/reference-checker/src/cli/main.ts`: base lookup among the supplied bases or the theme set, caret matching, depth at most 4, acyclicity, base validity and support (`OT-INH-001` to `OT-INH-005` at `base:<id>@<version>`), and trust as the lowest level in the chain (FR-048) (depends on T104)
- [x] T106 [US2] Extend `tools/reference-checker/src/resolve/declare.ts` with base-first merging: the child overrides values, overlays merge per `when` key, component styling merges, and a redefined point keeps its id and type while its constraints may be narrowed or replaced (data-model §10) (depends on T105)
- [x] T107 [US2] Extend `tools/reference-checker/src/resolve/select.ts` (FR-068, FB-001, FB-010):
  - an untrusted entry never replaces or shadows a trusted entry with the same id, is treated as distinct, and is flagged `OT-SEC-001`;
  - fallback diagnostics `OT-RES-001` to `OT-RES-004`;
  - the selected theme's validation errors are included in the output diagnostics
- [x] T108 [P] [US2] Write the inheritance section of `specification/spec/10-inheritance-and-resolution.md` (FR-046 to FR-048; flattening follows in US7), and the security sections of `specification/spec/12-security-and-limits.md`: forbidden content mapped to the DOC, TOK, CTX, and META codes (FR-066, FB-009), no external resources (FR-067), trust and identity (FR-010, FR-068, FB-010), and no partial application (FR-065)
- [x] T109 [P] [US2] Implement `tools/spec-lint/src/capability-scan.ts`. It fails `spec:check` if any of the following holds (FR-066, SC-012 automated part):
  - a string-typed schema location lacks `pattern`, `enum`, `const`, or `format`, unless it is marked `x-opentheme-display-text`;
  - `additionalProperties` is anything but false outside `$extensions` values;
  - any schema accepts a URI format
- [x] T110 [P] [US2] Implement `conformance/runner/src/checks/diagnostic-quality.ts` (the automated part of SC-005): every diagnostic from invalid and malicious fixtures has a code, a location, and a hint template present in `diagnostics.json`
- [x] T111 [P] [US2] Write `evaluations/diagnostic-review/PROTOCOL.md` and `evaluations/diagnostic-review/score.ts`: reviewers see only a fixture and its diagnostics, propose a fix, and pass at 90% or more (SC-005). This evaluation is manual and not part of CI
- [x] T112 [US2] Perform a security-focused review of `tools/reference-checker/src/parse/`, the limit enforcement in `tools/reference-checker/src/validate/`, and the diagnostic params against research R14 and R15 and FR-071. Record the findings and their resolutions in `specs/001-theme-specification-foundation/checklists/security-review.md` (Principle VI)
- [x] T113 [US2] Register the US2 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: Every invalid and malicious fixture is rejected with exact diagnostics, and no
partial application ever occurs. P1 is complete.

---

## Phase 5: User Story 3 - End user selects an available theme and mode (Priority: P2)

**Goal**: Theme and mode selection, localized display text, and automatic platform accessibility
(increased contrast, forced colors, reduced motion, larger text, RTL).

**Independent Test**: `pnpm conformance --filter "resolution/us3/**"` and the layer-5 matrix
fixtures. Each resolves to its single documented result.

### Tests for User Story 3 ⚠️

- [x] T114 [P] [US3] Write `conformance/fixtures/resolution/us3/` fixtures:
  - `localized-fa.json`: an `fa-IR` locale gives the `fa` name and description, and `de` gives the default ones (scenario 1, NFR-007);
  - `user-dark-over-platform-light.json` (scenario 2);
  - `platform-high-contrast-derived.json`: a theme with no high-contrast values uses the seed-derived mode, the policy cannot prevent it, and a user `std.contrast` "standard" cannot remove it (scenario 3, FR-052, FB-004);
  - `reduced-motion.json`: every `motion.duration.*` takes its reduced value even when the user chose `std.motion` "standard" (scenario 4);
  - `forced-colors.json`: every color token and contract color property is `{ system: role }` (scenario 5);
  - `dark-only-prefers-light.json`: dark with `OT-CTX-101` (scenario 6);
  - `rtl-mirroring.json`: logical directional values mirror and `physical: true` values do not (scenario 7);
  - `platform-text-scale.json`: platform 1.5 scales font sizes and dimension line heights, while unitless line heights stay unchanged;
  - `variant-fallback.json`: a `dim` variant falls back to its declared scheme (FB-003)
- [x] T115 [P] [US3] Write the layer-pair matrix fixtures `conformance/fixtures/resolution/matrix/L1-L5-*.json`, `L2-L5-*.json`, and `L4-L5-*.json`, one per dimension (15 fixtures), each with exactly one expected result (FR-058)

### Implementation for User Story 3

- [x] T116 [US3] Extend `tools/reference-checker/src/resolve/context.ts` with user dimension preferences through `resolve/enforce.ts` (FR-053, FR-052, FR-044):
  - `std.color-scheme` is the first choice, within allowed ∩ supported;
  - `std.contrast` and `std.motion` may only make presentation more accessible;
  - a point that is undeclared or not in `permittedPoints` is skipped with `OT-CUS-103`;
  - the preference status appears in the output
- [x] T117 [US3] Extend `tools/reference-checker/src/resolve/postprocess.ts` with the platform part:
  - forced colors map every color to its registry role (FR-054);
  - reduced motion applies the reduced durations (FR-028);
  - platform text scaling uses the FR-020 formula with the in-app factor 1;
  - logical-direction mirroring in RTL, with the physical opt-out (FR-077);
  - `displayText` selection using RFC 4647 lookup in `tools/reference-checker/src/resolve/index.ts`
- [x] T118 [P] [US3] Add the mode-selection sections (FR-052, FR-053, FB-003, FB-004) to `specification/spec/06-contexts-and-modes.md`, and the forced colors (FR-054), reduced motion (FR-028), platform text scaling (FR-020), direction (FR-077), and text-spacing (FR-076) sections to `specification/spec/11-accessibility.md`
- [x] T119 [US3] Register the US3 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: Mode selection and platform accessibility resolve deterministically, and US1 and
US2 still pass.

---

## Phase 6: User Story 4 - End user customizes permitted appearance properties (Priority: P2)

**Goal**: Bounded personalization of accent, text size, density, and corner roundness, within the
theme's customization points and the developer's policy. Preferences are never modified, and they
carry over between themes.

**Independent Test**: `pnpm conformance --filter "resolution/us4/**"`, the layer-3 matrix fixtures,
and the accent sweep in `pnpm sweeps` (SC-014). Each resolves to its single documented result.

### Tests for User Story 4 ⚠️

- [x] T120 [P] [US4] Write `conformance/fixtures/resolution/us4/` fixtures for scenarios 1–10:
  - `arbitrary-accent.json`: every accent-derived token is recomputed, except locked and `protected` ones;
  - `extreme-accents.json`: text and icons on the accent meet AA for near-white and near-black accents;
  - `not-permitted.json`: `OT-CUS-103`;
  - `clamp-and-fallback.json`: a range value is clamped with `OT-CUS-101`, a value between steps snaps with ties to the lower step, and a preset or enum value falls back with `OT-CUS-102`;
  - `aa-floor-reject.json`: status `rejected`, `OT-A11Y-007`, the default applied, and the rest applied;
  - `carry-over.json`: text size and compact density carry across two themes that both declare the standard points;
  - `point-removed.json`: `OT-CUS-104` when the `previous` version of the same theme declared the point;
  - `compact-target-size.json`: no interactive part below 24 px, with `OT-A11Y-006` when raised;
  - `narrow-then-widen.json`: the original stored value applies unchanged once the range is widened;
  - `text-scale.json`: with a range of 1 to 2, platform 1.5 × 1.2 gives 1.8, 1.5 × 1.5 gives 2.0, and platform 2.5 alone gives 2.5;
  - `policy-narrow-no-default.json`: narrowed constraints exclude the default and no replacement is given, which reports `OT-CUS-001` at `input`
- [x] T121 [P] [US4] Write the layer-pair matrix fixtures `conformance/fixtures/resolution/matrix/L1-L3-*.json`, `L2-L3-*.json`, `L3-L4-*.json`, and `L3-L5-*.json`, one per dimension (20 fixtures) (FR-058)
- [x] T122 [P] [US4] Write invalid declaration fixtures in `conformance/fixtures/invalid/cus/` for `OT-CUS-001` to `OT-CUS-006` (including a text-size `min` of 0.9 and an `effectiveRange.max` of 1.5), plus `conformance/fixtures/malicious/limits/customization-points-201.json` (`OT-LIM-004`) and a point with 17 targets (FR-042, FR-020)
- [x] T123 [P] [US4] Implement the accent sweep for SC-014: `conformance/sweeps/accents.json` (a 10 × 10 × 10 sRGB grid, 1,000 accents × each reference theme × every mode) and `conformance/runner/src/sweeps/accents.ts`. It asserts that every accent-related token is derived, every text-on-accent pair meets AA, every other declared pair either meets AA or the accent is rejected with `OT-A11Y-007`, and no pair is applied below AA

### Implementation for User Story 4

- [x] T124 [US4] Implement `tools/reference-checker/src/resolve/preferences.ts` for layer 3:
  - the effective set is the theme-declared points ∩ `permittedPoints`;
  - policy constraints may narrow but never widen, and narrowing that excludes the default requires a replacement default (FR-043);
  - token targets of 1–16 paths; `std.accent` targets `seed.accent` in every scheme; `std.corner-roundness` targets `radius.factor`; local points;
  - the last-declared point wins;
  - `protected` paths are immune to user values (FR-051);
  - `OT-CUS-104` when the `previous` version of the same theme declared a point that is now absent (FR-085);
  - user-dependent derivation operands are clamped with `OT-DRV-102`
- [x] T125 [US4] Extend `tools/reference-checker/src/resolve/postprocess.ts` (FR-020, FR-075):
  - the in-app text factor comes from `std.text-size`;
  - effective scale = max(platform, clamp(platform × in-app, effectiveRange.min, effectiveRange.max)), with the effective range narrowed by policy when given;
  - density comes from `std.density`;
  - interactive parts are floored at 24 px at every density, with `OT-A11Y-006`
- [x] T126 [US4] Extend `tools/reference-checker/src/resolve/check.ts` with the accessibility floor (FB-007, research R12):
  - under `wcag22-aa`, every user value that a failing pair depends on (through the declaration graph) is rejected with `OT-A11Y-007`;
  - stages 3–7 then re-run exactly once with those points at their documented defaults;
  - under `relaxed`, failures stay as warnings
- [x] T127 [P] [US4] Add the policy narrowing (FR-043), presentation information (FR-045), carry-over (FR-041), and removed-point skipping (FR-085, FB-006) sections to `specification/spec/09-customization-points.md`. Add the user layer and accessibility-floor re-run sections to `specification/spec/10-inheritance-and-resolution.md`, and the target size (FR-075) and in-app factor (FR-020) sections to `specification/spec/11-accessibility.md`
- [x] T128 [US4] Extend `conformance/runner/src/sweeps/official.ts` so that no interactive part of the baseline or any reference theme resolves below 24 px at compact, standard, or comfortable density (SC-006)
- [x] T129 [US4] Register the US4 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: Personalization is bounded, deterministic, and accessible, and the accent sweep
passes.

---

## Phase 7: User Story 5 - Host-defined component contracts and cross-application portability (Priority: P2)

**Goal**: Hosts declare extension contracts, extension tokens, and layout variants in their own
namespace. Themes stay portable across hosts.

**Independent Test**: Apply every reference theme to both reference host declarations. Both hosts
are fully styled with no edits, and every US5 fixture passes (SC-002).

**Depends on**: US1 (reference themes).

### Tests for User Story 5 ⚠️

- [x] T130 [P] [US5] Write host fixtures in `conformance/fixtures/valid/host/` and `conformance/fixtures/invalid/host/`:
  - `conformance/fixtures/valid/host/{notes,media}.json` (via `$file`);
  - `conformance/fixtures/invalid/host/`: namespaces `std`, `org.opentheme.x`, and `uid.x` (`OT-HOST-001`, US5 scenario 3); a state outside the allowed set or a non-R4 property type (`OT-HOST-002`); a default that does not resolve (`OT-HOST-003`); a duplicate contract id (`OT-HOST-004`); 17 variant axes (a LIM code)
- [x] T131 [P] [US5] Write `conformance/fixtures/resolution/us5/` fixtures:
  - `host-defaults.json`: a theme that is unaware of the host resolves the timeline from the host defaults using its semantic values (scenario 1);
  - `foreign-contract-ignored.json`: a notes-styled theme on the media host gives `OT-CMP-001`, and the rest applies (scenario 2);
  - `incompatible-version.json`: `OT-CMP-002` (scenario 4);
  - `navigation-side.json`: side navigation for expanded, with only the variant name in the output (scenario 5);
  - `invalid/lay/content-changes.json`: `hidden`, `order`, and `insert` members give `OT-DOC-003` (scenario 6);
  - `unknown-region.json`: `OT-LAY-001`;
  - `invalid/lay/reflow-320.json`: `OT-LAY-002`
- [x] T132 [P] [US5] Write `conformance/fixtures/resolution/us5/portability-{aurora,graphite}-{notes,media}.json` (4 fixtures). Each asserts complete resolution with no edits and 100% coverage of the host's `consumes` list (SC-002, FR-087)

### Implementation for User Story 5

- [x] T133 [P] [US5] Write `specification/schemas/1.0/host-declaration.schema.json` per contracts/host-declaration.md and data-model §13:
  - `openthemeHost` is MAJOR.MINOR;
  - `id` is the reverse-domain host namespace, which "must not be, or start with, a reserved namespace (`std`, `org.opentheme`, `uid`)";
  - `catalog`;
  - `consumes` is optional;
  - `contracts` follow the §7 fields;
  - `tokens` each have a path, type, description, and a default that aliases or derives from standard tokens;
  - `layoutVariants` maps a region to `{ variants: [names], default }`
- [x] T134 [US5] Implement `tools/reference-checker/src/validate/host.ts` and the `ot-ref validate-host` and `--host <file>` CLI options: namespace rules, contract structure, defaults resolving against the baseline plus host tokens, no cycles, and limits (`OT-HOST-001` to `OT-HOST-004`) (depends on T133)
- [x] T135 [US5] Extend `tools/reference-checker/src/resolve/{declare,evaluate,index}.ts` with host tokens (qualified paths) and host contracts with defaults:
  - styling applies only when the contract versions are compatible (same major, and a minor no newer than declared); otherwise `OT-CMP-002`;
  - an unknown contract gives `OT-CMP-001`;
  - completeness covers host contracts and tokens (FR-032, FR-086)
- [x] T136 [US5] Add the `layout` member (`variants.<region>`: a variant name, or a map from size class to variant name) to `specification/schemas/1.0/theme.schema.json` and the overlay `layout` member to `specification/schemas/1.0/defs/contexts.schema.json`, creating `specification/schemas/1.0/defs/layout.schema.json`. Implement `tools/reference-checker/src/validate/layout.ts`:
  - FR-039: "at the narrowest size class, minimum and fixed widths plus gutters must fit within 320 px", else `OT-LAY-002`;
  - variant selection per size class, with the host default and `OT-LAY-001` for undeclared regions or variants
- [x] T137 [P] [US5] Author `specification/hosts/com.example.notes.opentheme-host.json` (contracts `timeline` and `tag-chip`, token `color.rail`, navigation `top|side|bottom`) and `specification/hosts/com.example.media.opentheme-host.json` (contracts `player-controls` and `playlist-row`, a differently structured `library: list|grid` layout variant). Both use domain-neutral descriptions (FR-088, FR-099)
- [x] T138 [US5] Update `specification/themes/reference/org.opentheme.aurora.opentheme.json`, which styles `com.example.notes/timeline` and selects navigation per size class, and `specification/themes/reference/org.opentheme.graphite.opentheme.json`, which styles `com.example.media/playlist-row`, with matching `compatibility.extensions` (depends on T137)
- [x] T139 [P] [US5] Write the layout sections (FR-035 to FR-039) of `specification/spec/08-components-and-layout.md` and `specification/spec/17-host-declarations.md` (FR-031, FR-032, FR-086, FR-087, FR-089)
- [x] T140 [US5] Implement `conformance/runner/src/checks/host-coverage.ts`, which reports the coverage of every reference theme × reference host combination against `consumes`, the standard tokens, and the contracts, and fails below 100% (SC-001, SC-002)
- [x] T141 [US5] Register the US5 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: Both reference hosts are fully styled by every reference theme, and foreign styling
is ignored without error.

---

## Phase 8: User Story 6 - Specification and theme versions evolve without breaking users (Priority: P3)

**Goal**: Additive 1.x evolution, deprecation warnings, deterministic migration from the previous
major, and classification of breaking theme changes.

**Independent Test**: `pnpm conformance --filter "versioning/**"` matches every documented outcome,
including the simulated previous major.

### Tests for User Story 6 ⚠️

- [x] T142 [P] [US6] Write `conformance/fixtures/versioning/` fixtures:
  - `deprecated-token.json`: valid, with `OT-VER-005` naming the replacement (scenario 2, FB-011);
  - `simulated-previous-major/migrate-*.json` with `profile` "simulated-previous-major": deterministic migration with `OT-VER-003` and a lossy drop with `OT-VER-004` (scenario 3), and an input outside the window, which is unsupported;
  - `compare-*.json` (kind `compare-versions`), where these are breaking: removing a point, changing a point's type or target, narrowing constraints so previous values no longer fit, and removing a supported color scheme or `compatibility.extensions` namespace;
  - and these are compatible: value changes, an added point, and a widened range (scenario 4, FR-084)
- [x] T143 [P] [US6] Create `conformance/fixtures/versioning/freeze-1.0.json`, listing every valid and resolution fixture id with the SHA-256 of its `expect`. Implement `tools/spec-lint/src/compat-freeze.ts`, which fails if a frozen fixture is removed or its expectation changes without an entry in `specification/CHANGELOG.md` marked "bug fix" (scenario 1, FR-080, SC-013)

### Implementation for User Story 6

- [x] T144 [P] [US6] Write `specification/schemas/1.0/migration-manifest.schema.json` per data-model §19: `{ from: "M.x", to: "N.0", operations }`, where operations are `rename-path { from, to }`, `move-member { from, to }`, `map-value { at, mapping }`, and `drop-member { at, lossy: true }`
- [x] T145 [US6] Implement `tools/reference-checker/src/versioning/migrate.ts` and `ot-ref migrate <theme> --manifest <file>` (depends on T144):
  - apply the operations in order, and every lossy operation gives `OT-VER-004`;
  - under the test-only profile `simulated-previous-major`, with manifest `conformance/fixtures/versioning/simulated-previous-major/manifest.json`, the version gate accepts the previous major only through migration, giving `OT-VER-003`
- [x] T146 [US6] Implement `tools/reference-checker/src/versioning/compare.ts` and `ot-ref compare <old> <new>`: FR-084 classification (`compatible` or `breaking`) with machine-readable reasons
- [x] T147 [US6] Extend `tools/reference-checker/src/validate/tokens.ts` so that aliases to `$deprecated` tokens (in the theme or a base) and uses of registry elements marked `deprecated` give `OT-VER-005`, with the replacement in params (FR-023, FR-083)
- [x] T148 [US6] Add the kinds `compare-versions` and `migrate`, and fixture `profile` handling, to `tools/reference-checker/src/conformance/serve.ts` and `conformance/runner/src/compare.ts`
- [x] T149 [P] [US6] Write `specification/spec/14-versioning-and-migration.md` (FR-079 to FR-086):
  - specification SemVer and draft labels;
  - `opentheme` targeting as MAJOR.MINOR, with M.0 through M.N accepted;
  - unsupported diagnostics;
  - migration manifests and the deprecation window;
  - deprecation announcements;
  - theme-version classification;
  - contract versioning
- [x] T150 [US6] Register the US6 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: Version compatibility, deprecation, and migration are verified by fixtures.

---

## Phase 9: User Story 7 - End users create, save, and share themes with the same specification (Priority: P3)

**Goal**: User-created and derived themes use the same rules. They export as self-contained,
canonical, integrity-protected documents that round-trip losslessly.

**Independent Test**: `pnpm conformance --filter "canonical/**"` and the automatic round-trip check
on every valid fixture (SC-011).

**Depends on**: US1 (Aurora as a base) and US2 (inheritance).

### Tests for User Story 7 ⚠️

- [x] T151 [P] [US7] Write `conformance/fixtures/canonical/` fixtures (FR-069, FR-089, FR-094, edge cases):
  - variants that differ only in formatting or member order have identical canonical bytes and integrity;
  - normalization: `alpha: 1` is removed, a hex-only color becomes `components`, and `integrity` is excluded;
  - `$extensions` is preserved byte-for-byte;
  - `resolution/us7/same-id-version-different-content.json`: `OT-SEC-002`, kept distinct
- [x] T152 [P] [US7] Write `conformance/fixtures/canonical/flatten-*.json` and `export-*.json`:
  - a user-created child of Aurora flattens to one document, with `extends` removed, the lineage appended oldest first, and values equal to the resolved chain (scenario 2, FR-049);
  - a theme without an author or license fails the export check with `OT-META-008` naming the fields, while staying valid (scenario 4);
  - a `preferences` member gives `OT-DOC-003` (FR-095);
  - `resolution/us7/user-child-untrusted.json`: the same rules apply and the theme is untrusted (scenario 1, FR-097)
- [x] T153 [US7] Implement `conformance/runner/src/checks/round-trip.ts`. For every valid fixture it performs canonicalize, then re-parse, then canonicalize, and checks that the bytes and integrity are identical (scenario 3, SC-011)

### Implementation for User Story 7

- [x] T154 [US7] Implement `tools/reference-checker/src/canonical/{normalize,integrity}.ts`:
  - the closed normalization list of research R3;
  - SHA-256 via Web Crypto, written as `sha256-` plus standard base64;
  - add the `integrity` member (pattern `^sha256-[A-Za-z0-9+/]{43}=$`) to `specification/schemas/1.0/theme.schema.json`
- [x] T155 [US7] Implement `tools/reference-checker/src/canonical/flatten.ts` and the export-eligibility check, and add them to the CLI (`ot-ref canonicalize`, `ot-ref flatten`, `ot-ref export-check`) and to `serve.ts` (kinds `canonicalize` and `flatten`) (depends on T154):
  - flattening applies the chain base-first, drops `extends`, and appends `provenance.lineage`;
  - export eligibility requires `author`, `license`, and `integrity`, with `OT-META-008`
- [x] T156 [P] [US7] Write the canonical form and integrity sections of `specification/spec/01-document-format.md` (FR-069, FR-094) and `specification/spec/15-extensions-and-provenance.md` (FR-008, FR-010, FR-049, FR-089, FR-095, FR-097, and FR-098, which keeps digital signatures possible)
- [x] T157 [P] [US7] Write `specification/spec/16-design-tokens-mapping.md` (FR-096, research R19):
  - export as one DTCG 2025.10 document per mode with computed values, and the derivation source in `$extensions["org.opentheme"]`;
  - the import mapping;
  - the list of what does not map (derivations, overlays and their optional Resolver Module modifiers, contracts, points);
  - worked examples in `opentheme` code blocks, verified by the spec-lint examples check
- [x] T158 [US7] Register the US7 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: Canonical form, integrity, flattening, and export eligibility are verified, and
every valid fixture round-trips.

---

## Phase 10: User Story 8 - AI generates or modifies a theme through the specification (Priority: P3)

**Goal**: The machine-readable specification and examples alone are enough to produce and correct
valid themes, with no AI-specific exception.

**Independent Test**: `pnpm spec:check` passes the machine-readability check, the US8 fixtures
pass, and the SC-008 protocol is runnable.

**Depends on**: US5 (the host-extension example). The other examples need only the Foundational
phase.

### Tests for User Story 8 ⚠️

- [x] T159 [P] [US8] Implement `tools/spec-lint/src/machine-readability.ts`, which fails `spec:check` unless every schema property and definition has a `description` and `examples`, every registry entry has a description and an example, and every diagnostic code has message and hint templates (FR-003, FR-090, NFR-006)
- [x] T160 [P] [US8] Write fixtures in `conformance/fixtures/malicious/ai/` and `conformance/fixtures/resolution/us8/` (FR-010, FR-097):
  - `conformance/fixtures/malicious/ai/*.json`: provenance "ai-generated" variants of the content fixtures, which are invalid in exactly the same way (scenario 3);
  - `conformance/fixtures/resolution/us8/ai-untrusted.json`: provenance "ai-generated" supplied as untrusted is treated as untrusted, and a theme that claims "prebuilt" provenance but is supplied untrusted stays untrusted (scenario 4)

### Implementation for User Story 8

- [x] T161 [US8] Author `specification/examples/`, each example as `<nn>-<name>.opentheme.json` plus an annotation file `<nn>-<name>.md`, mirrored as fixtures in `conformance/fixtures/examples/` (FR-092):
  - `01-minimal-seed-only`, `02-light-and-dark`, `03-high-contrast-overrides`, `04-derived-accent-family`, `05-component-styling`, `06-customization-points`, `07-host-extension` (for `com.example.notes`), and `08-full-featured`;
  - `invalid/`, with at least one example per error area and its expected diagnostics;
  - documents use meaningful names and stay reviewable as text diffs (NFR-005)
- [x] T162 [US8] Write `specification/examples/09-modify-corner-roundness.md` with before and after documents and the list of edited JSON Pointers, showing the change as edits to addressable values that pass full validation (scenario 2, FR-091)
- [x] T163 [US8] Write `specification/llms.txt`:
  - the purpose;
  - links to every schema, registry, example, and `diagnostics.json`;
  - the rules: closed transformations, no free text outside display text, seeds are required, and high contrast is always present;
  - common mistakes: `$type` in overlays, aliasing primitives from hosts, exceeding derivation depth, and styling undeclared states (FR-090)
- [x] T164 [P] [US8] Write `evaluations/ai-generation/PROTOCOL.md` and `evaluations/ai-generation/run.ts` for SC-008. This evaluation is manual, not part of CI, and not a dependency of any package (Principle VII):
  - the script is provider-agnostic: it runs a user-supplied command once per attempt, with the prompt on stdin;
  - the context is `llms.txt` and its linked files only;
  - each result is validated with `ot-ref`;
  - there is one correction round using only the diagnostics JSON;
  - it runs at least 100 attempts across at least two models, then scores first-attempt validity (90% or more) and validity after correction (99% or more)
- [x] T165 [US8] Register the US8 rules in `specification/registry/1.0/rules.json` and update the `fixtures` lists in `diagnostics.json`

**Checkpoint**: The specification is self-sufficient for automated producers.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Whole-suite completeness, performance budgets, release gates, and final documentation

- [x] T166 [P] Switch `tools/spec-lint/src/traceability.ts` to strict mode. `spec:check` now fails on any rule without a fixture, any fixture without a rule, or any FR-001 to FR-099 without a rule or an artifact check (FR-002, NFR-010)
- [x] T167 [P] Implement `tools/spec-lint/src/resolution-coverage.ts`, which fails unless resolution fixtures cover all 10 layer pairs × 5 dimensions, FB-001 to FB-013, US3 scenarios 1–7, US4 scenarios 1–10, and the FR-020 text-scale cases, each with exactly one expected result (FR-058, SC-009 automated part)
- [x] T168 [P] Implement `tools/spec-lint/src/domain-terms.ts` with the term list `tools/spec-lint/data/domain-terms.txt`. It scans the chapters, registries, and schemas and fails on any domain-specific term; example host namespaces under `specification/hosts/` and `specification/examples/` are allowlisted (FR-088, SC-012 automated part)
- [x] T169 [P] Write `evaluations/vocabulary-review/PROTOCOL.md` (SC-012), `evaluations/resolution-prediction/PROTOCOL.md` with `score.ts` (SC-009, pass at 95%), and `evaluations/authoring-timing/PROTOCOL.md` with `score.ts` (SC-007: at least 80% of five or more newcomers produce a seed-only theme in 15 minutes and a light, dark, and high-contrast theme in 30 minutes)
- [x] T170 Implement `tools/bench/src/node.ts` with fixture `tools/bench/fixtures/typical.opentheme.json` (1,000 tokens) and a generated at-limit theme (NFR-003, research R22, Principle VIII):
  - `pnpm bench` fails when a median exceeds its budget: 25 ms to validate and resolve a typical theme, 250 ms at the limits, 5 ms to reject 10 MiB, 4 ms to re-resolve after a context change;
  - also write `tools/bench/src/browser.ts` and `tools/bench/index.html` for `pnpm bench:browser`, which confirms SC-010 on the named mid-range Android reference device before release
- [x] T171 Implement `tools/spec-lint/src/release-check.ts` for `pnpm release:check`. It fails on any of the following (research R21, constitution TODO(LICENSE) and TODO(MAINTAINERS)):
  - any `LicenseRef-OpenTheme-Pending`;
  - no maintainer list in `.specify/memory/constitution.md`;
  - a specification version that still carries a draft label;
  - any failing `pnpm verify` step;
  - an evaluation without a recorded passing result in `evaluations/results.json`
- [x] T172 [P] Write `specification/CHANGELOG.md` with the `1.0.0-draft.1` entry listing the delivered chapters, schemas, registries, themes, hosts, and fixture classes
- [x] T173 Update root `AGENTS.md` with the final commands and invariants. Add a link check to `tools/spec-lint/src/consistency.ts` so every link in `specification/llms.txt` and the chapters resolves
- [x] T174 Run `pnpm verify`, which covers quickstart.md sections 1–5 and 7. Fix any difference between `specs/001-theme-specification-foundation/quickstart.md` and the actual commands or outputs
- [x] T175 Reconcile the design documents with the implementation. Update `specs/001-theme-specification-foundation/{plan.md,data-model.md,contracts/*.md}` wherever the implemented schemas, registries, or CLI differ, and re-run `pnpm spec:check`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User stories (Phases 3–10)**: Each depends on Foundational, plus the story dependencies below.
- **Polish (Phase 11)**: Depends on every story that is in scope for the release.

### User Story Dependencies

| Story | Depends on | Reason |
|---|---|---|
| US1 (P1) | Foundational; T086 → T137 | Themes and most US1 work need only the foundation; SC-001 completeness fixtures need the notes reference host (T137) |
| US2 (P1) | Foundational | Uses the foundation's validator and fallback chain; independent of US1 |
| US3 (P2) | Foundational | Uses the foundation's `resolve/enforce.ts`; independent of US1 and US2 |
| US4 (P2) | Foundational, US1 | The accent sweep (SC-014) and the carry-over fixtures use the reference themes |
| US5 (P2) | Foundational, US1 | SC-002 applies the reference themes to both hosts; T138 edits them |
| US6 (P3) | Foundational | Independent |
| US7 (P3) | US1, US2 | Flattening needs inheritance (US2) and uses Aurora as the base |
| US8 (P3) | Foundational, US5 for `07-host-extension` | The other examples need only the foundation |

```text
Setup → Foundational ─┬─ US1 ─┬─ US4
                      │       ├─ US5 ── US8 (host example)
                      │       │   └─ T137 notes host ← T086 (SC-001)
                      │       └─┐
                      ├─ US2 ───┴─ US7
                      ├─ US3
                      └─ US6
                                  all → Polish
```

### Within Each Phase

- Fixtures and unit tests come first and must fail before implementation.
- Schemas come before the generated types, which come before the reference checker modules that
  consume them.
- Normative chapter sections come before or alongside the behavior they define (Principle IV).
- Tasks that edit `rules.json`, `diagnostics.json`, `semantic-baseline.json`, a reference theme, or
  the same TypeScript module are sequential. They carry no [P].
- Each story ends by registering its rules. A story is complete only when its fixtures pass under
  `pnpm conformance`.

---

## Parallel Execution Examples

### Foundational

```text
# Registries and schema defs (all different files):
T013 limits.json · T014 diagnostics.json · T015 context-dimensions.json · T016 forced-colors.json
T017 transformations.json · T019 diagnostic.schema.json · T020 fixture.schema.json
T022 metadata defs · T023 seeds defs · T024 tokens defs · T025 derivation defs
T026 contexts defs · T027 components defs · T028 customization defs

# Chapters 00–13 (T031–T044), one agent per chapter.

# Tests that precede each module:
T050 parser · T052 collector · T058 kernels · T062 color · T064 transforms · T066 graph
```

### User Story 1

```text
T087 unstyled-contract · T088 policy-lock · T089 baseline fallback
T090 official-theme metadata check · T091 L1/L2/L4 matrix
then in parallel: T093 chapter section · T094 Aurora · T095 Graphite
T086 completeness fixtures (after T137 notes host)
```

### User Story 2

```text
T098 content fixtures · T099 limit fixtures · T100 invalid fixtures · T101 inheritance fixtures
T102 resolution fixtures · T103 bounded-effort property test
later in parallel: T108 chapter sections · T109 capability scan · T110 diagnostic quality · T111 SC-005 protocol
```

### User Story 3

```text
T114 us3 fixtures · T115 L*-L5 matrix   → then T116 → T117, with T118 in parallel
```

### User Story 4

```text
T120 us4 fixtures · T121 L3 matrix · T122 invalid/cus · T123 accent sweep
then T124 → T125 → T126, with T127 in parallel
```

### User Story 5

```text
T130 host fixtures · T131 us5 fixtures · T132 portability fixtures · T133 host schema
T137 reference hosts · T139 chapters
```

### User Stories 6–8

```text
US6: T142 · T143 · T144 · T149 in parallel
US7: T151 · T152 · T156 · T157 in parallel
US8: T159 · T160 · T164 in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational). This is the largest phase, because the core vocabulary,
   kernels, validator, and resolver block every story.
3. Complete Phase 3 (US1), then T137 (notes host) and T086 so SC-001 completeness fixtures resolve
   against a reference host.
4. **Stop and validate**: run `pnpm conformance`, `pnpm sweeps`, and `pnpm kernels:crosscheck`. The
   reference themes and the baseline are complete and AA-conformant in every mode; SC-001 host-backed
   completeness holds for the notes host.

### Incremental Delivery

1. Setup plus Foundational: seed-only themes validate and resolve.
2. US1, the MVP: official prebuilt themes.
3. US2, completing P1: safe rejection, inheritance, and trust.
4. US3, US4, and US5 (P2): mode selection, personalization, and host portability.
5. US6, US7, and US8 (P3): versioning, sharing readiness, and AI readiness.
6. Polish: strict traceability, coverage, budgets, and release gates.

Each increment keeps every earlier fixture passing. The compatibility freeze (T143) protects
earlier results from US6 onward.

### Parallel Team Strategy

After Foundational:

- Developer A: US1, then US4.
- Developer B: US2, then US7.
- Developer C: US3, then US6.
- Developer D: US5 once T094 and T095 exist, then US8.

---

## Notes

- **Expected values**:
  - Resolution fixtures assert exact values only where a person can derive and check them by hand.
  - For large outputs, use `subset` assertions plus runner invariants (completeness, accessibility,
    equality relations).
  - A value produced by the reference checker must be checked independently before it is
    committed, e.g., through the Python kernel cross-check or manual review. The reference checker
    is non-normative and must not define its own expected results.
- **Release blockers**: two items need a governance decision, and no task can resolve them. One is
  the license (`TODO(LICENSE)`), which must be OSI-approved for code (Principle XII). The other is
  the maintainer group (`TODO(MAINTAINERS)`). T171 keeps them from shipping unresolved.
- **SC-004** is a cross-feature release gate (two independently developed validators must agree).
  This feature delivers the protocol, fixtures, runner, and reference checker. Full SC-004 is
  verified when the production core (a later feature) passes the same suite; do not treat this
  feature alone as completing SC-004.
- Commit after each task or logical group. Stop at any checkpoint to validate a story
  independently.
