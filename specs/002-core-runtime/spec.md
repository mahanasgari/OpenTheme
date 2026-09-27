# Feature Specification: OpenTheme Core Runtime

**Feature Branch**: `002-core-runtime`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Define the OpenTheme Core Runtime: a production-quality,
framework-agnostic runtime library that turns the existing Theme Specification and Resolution
Contract into reusable programmatic capabilities (loading, validation, host-assigned trust,
registration, selection, inheritance, deterministic resolution, user preferences, developer
policy, platform and environment context, accessibility, diagnostics, safe fallback, resource
limits, optional caching, and injectable persistence) for future output targets and framework
adapters. Reuse the Foundation; do not redesign it, add a second resolution model, weaken its
rules, or implement adapters, UI, marketplace, sharing, or AI."

## Relationship to the Foundation *(read first)*

This feature builds on `001-theme-specification-foundation`, which is complete and audited. The
Foundation is the source of truth. This specification adds **no** normative theme behavior.

- **Normative sources Core implements, never restates**: the constitution;
  `specification/spec/00`–`17`; `specification/schemas/1.0/`; `specification/registry/1.0/`;
  and the conformance suite in `conformance/` (fixtures, sweeps, runner protocol).
- **Resolution**: Core implements the Foundation's single resolution function,
  `resolve(input, registries) → { resolved, diagnostics }` (chapter 10;
  `contracts/resolution.md`; research R12). Core's stateful and convenience capabilities only
  *assemble* that input and *deliver* its output. They never reorder, add, or skip precedence
  layers or stages.
- **Reference implementation**: the reference checker (`ot-ref`) is private and non-normative
  (chapter 00; research R18). Core is the independent production implementation that closes the
  Foundation's cross-feature release gate SC-004. Core therefore MUST be developed against the
  specification and the conformance suite, not by importing or copying the reference checker.
- **Deferred Foundation items this feature touches**: the Foundation deferred both the
  Customization Policy and the User Preferences document formats (Foundation spec, Out of Scope
  and Assumptions), and both "must compile into [the abstract resolution input] losslessly"
  (`contracts/resolution.md`). Following clarification 1, this feature defines the User
  Preferences document (FR-C067–FR-C069). The Customization Policy document format stays
  deferred; Core accepts the abstract policy and presets (FR-C060, FR-C065).
- Conflicts and gaps found while reading the Foundation are listed in
  [Foundation Alignment Findings](#foundation-alignment-findings). None were fixed here.

In this document, requirement identifiers use the prefix `FR-C`, `NFR-C`, `FB-C`, and `SC-C` so
they cannot be confused with Foundation identifiers (`FR-`, `NFR-`, `FB-`, `SC-`), which are
cited unchanged.

## Architectural Boundary

```text
Theme Specification (normative: prose, schemas, registries, fixtures)       ← 001, unchanged
        ↓ defines
Reference checker + conformance runner (non-normative verification)        ← 001, unchanged
        ↓ verifies (same suite, same protocol)
OpenTheme Core (this feature)                                              ← 002
        ↓ produces one Resolved Theme (resolved-theme.schema.json)
Output targets (e.g., CSS custom properties, native style objects)         ← later feature
        ↓
Framework adapters (e.g., React, Vue, Svelte, Angular, Web Components, RN) ← later features
        ↓
Host application
```

| Layer | Owns | Does not own |
|---|---|---|
| Theme Specification | Theme format, token semantics, transformations, kernels, contexts, precedence, resolution algorithm, accessibility rules, limits, diagnostic codes, versioning, canonical form | Runtime APIs, state, storage |
| Reference checker | Authoring and verifying the specification's artifacts | Production use; being copied by Core |
| **Core** | Validated theme lifecycle, host-assigned trust, registry, assembling the resolution input, running the normative resolution, personalization state, policy and preference models at runtime, persistence and source abstractions, diagnostics delivery, fail-closed fallback state, internal memoization | Rendering, platform units, CSS, DOM, framework reactivity, UI, networking, storage media, business logic |
| Output targets | Converting a Resolved Theme into a platform representation through escaping serializers | Validation, resolution, policy |
| Adapters | Lifecycle, reactivity, dependency injection, server rendering and hydration, translating platform state into Core context | Any validation, resolution, or policy logic (constitution V) |

## Clarifications

### Session 2026-09-25

- Q: Should this feature define the versioned saved format for user preferences and for developer
  policy, or leave both to later features? → A: This feature defines the versioned User
  Preferences document format (FR-C067, FR-C068). The developer policy stays an abstract,
  host-supplied contract (the resolution-input `policy`) plus presets; its document format stays
  a later feature.
- Q: How does a developer allow themes they did not ship (user-created, imported, shared,
  AI-generated), given closed defaults? → A: Through per-source host settings in Core, all off by
  default. The host states the source of each untrusted admission; document provenance is never
  used (FR-C024, FR-C026).
- Q: Which error vocabulary do non-theme failures use? → A: Split. Runtime and API failures use
  a Core-versioned operational error vocabulary without the `OT-` prefix. User Preferences
  document findings get new registry codes in a new `PREF` area, added through the
  contract-change process (FR-C083, FR-C069).
- Q: Which version applies when a selection names no version and several are registered? → A:
  The highest SemVer precedence among the versions available under the policy. If that version is
  invalid, the normal FB-001 fallback chain applies; older versions are not searched. This is
  recorded as a Foundation errata to chapter 10 with a fixture (FR-C034).
- Q: Should Core stop a valid untrusted theme that misses WCAG 2.2 AA contrast, and who can turn
  that off? → A: Yes, with an admission gate in Core, on by default for untrusted themes. The
  host may relax it explicitly. Trusted themes are reported only, never blocked (FR-C028).

## User Scenarios & Testing *(mandatory)*

The actors are **host developers** (who integrate OpenTheme), **adapter and output-target
authors** (who build on Core), and **end users** (whose preferences Core applies). Core has no
UI, so end-user stories are tested through Core's programmatic surface, as an adapter would drive
it.

### User Story 1 - Host developer ships prebuilt themes through Core (Priority: P1)

A host developer installs Core, registers the bundled official themes as trusted, supplies a
policy (or a policy preset) and the host declaration, provides the current platform and
environment context, and obtains a complete Resolved Theme without authoring any theme values.

**Why this priority**: This is the constitution's minimum integration path (Principles III and
XI) and the smallest slice that delivers value. Every other story depends on it.

**Independent Test**: Run the quickstart as an automated test: register the reference themes and
a reference host declaration, apply a preset policy, and resolve every supported mode. Pass if the
result is identical, byte for byte, to the conformance suite's expected output for the equivalent
resolution input, and every consumed token and contract property has a value.

**Acceptance Scenarios**:

1. **Given** the reference themes registered as trusted and a reference host declaration,
   **When** the developer resolves the default theme for any supported context, **Then** Core
   returns a complete Resolved Theme (Foundation FR-057) that conforms to
   `resolved-theme.schema.json`.
2. **Given** the developer uses the documented default policy preset, **When** they resolve,
   **Then** only developer-registered themes can be selected and no token-level customization is
   permitted (closed defaults, constitution III).
3. **Given** the developer's default theme is missing or invalid, **When** Core resolves, **Then**
   the specification baseline theme is applied, `applied.fallback` is
   `specification-baseline`, and the fallback diagnostic is present (FB-001, FB-013).
4. **Given** a policy that locks a semantic token to a brand color, **When** Core resolves,
   **Then** the result equals the conformance suite's expected output for the same input
   (Foundation US1 scenario 3).
5. **Given** a completed registration, **When** the host resolves during server-side rendering,
   **Then** resolution completes without any asynchronous step, network, or storage access
   (constitution VIII, first paint).

---

### User Story 2 - Untrusted, invalid, and hostile input never reaches the applied appearance (Priority: P1)

A host accepts theme documents from sources other than its own build (files a user opens, other
applications, future sharing or AI features). Core must reject anything invalid or hostile as a
whole, with diagnostics, while the application keeps a valid appearance.

**Why this priority**: The security model is non-negotiable (constitution VI). A runtime that
could partially apply hostile input would make every later capability unsafe.

**Independent Test**: Feed every invalid and malicious conformance fixture through Core's
admission and resolution paths, and through a stateful controller that already has a valid theme
applied. Pass if every fixture yields its expected diagnostics, no fixture changes the applied
appearance, and the previously applied theme remains in effect in full.

**Acceptance Scenarios**:

1. **Given** a document larger than the document-size limit, **When** it is admitted, **Then** it
   is rejected before parsing with `OT-LIM-001` and bounded effort (FB-008; research R14).
2. **Given** a document that carries forbidden content, **When** it is admitted, **Then** it is
   rejected with the registry code and location, and no diagnostic reproduces the content in an
   interpretable form (FB-009, FR-071).
3. **Given** a host admits a document as untrusted that claims the identifier of a trusted
   registered theme, **When** the user selects that identifier, **Then** the trusted theme is used,
   the untrusted one stays distinct, and `OT-SEC-001` is reported (FR-068, FB-010).
4. **Given** a document whose provenance claims `prebuilt` or `specification-baseline`, whose
   identifier is `org.opentheme.*`, or whose metadata names a well-known author, **When** the host
   admits it as untrusted, **Then** its trust level is untrusted (FR-010).
5. **Given** a trusted child theme whose base was admitted as untrusted, **When** it is resolved,
   **Then** the resolved trust is untrusted (FR-048).
6. **Given** a valid theme A is applied through a controller, **When** the user selects an invalid
   theme B, **Then** A remains applied in full, B's diagnostics are reported, and the persisted
   selection is not changed to B (Foundation US2 scenario 7; FB-001).
7. **Given** a host admits a document without stating a trust level, **When** admission runs,
   **Then** admission does not proceed and Core reports the missing trust to the host. It never
   defaults to trusted.
8. **Given** default host settings, **When** the host admits any untrusted document (from any
   source category), **Then** admission is refused and nothing is registered. **Given** only
   `imported` is allowed, **When** the host admits an untrusted document stated as
   `ai-generated` whose provenance claims `imported`, **Then** it is refused.
9. **Given** an allowed source and default settings, **When** the host admits a valid untrusted
   theme whose text pair misses AA in dark mode, **Then** admission is refused and the
   `OT-A11Y-003` diagnostics are returned. **Given** the same theme admitted as trusted,
   **Then** it is registered and the shortfall is only reported.

---

### User Story 3 - Adapters drive live context changes deterministically (Priority: P2)

An adapter observes platform state (color scheme, increased contrast, forced colors, reduced
motion, text scaling) and environment state (size class, locale, direction), translates it into
Core's context model, and asks Core for the updated Resolved Theme whenever it changes.

**Why this priority**: Honoring platform accessibility preferences live is required (constitution
VIII; Foundation US3). It depends on US1.

**Independent Test**: Replay every Foundation resolution example that varies platform or
environment context through Core's context model. Pass if each produces its single documented
result and repeated calls with identical inputs produce identical bytes.

**Acceptance Scenarios**:

1. **Given** the platform requests increased contrast, **When** Core resolves, **Then** the
   selected theme's high-contrast mode is used and the user stays in the selected theme (FB-004).
2. **Given** reduced motion is requested by the platform, **When** a user preference or policy
   asks for standard motion, **Then** every motion value is its reduced value (FR-052).
3. **Given** forced colors are active, **When** Core resolves, **Then** every color is a system
   color role (FR-054).
4. **Given** a context change that does not alter any resolution input, **When** the adapter asks
   again, **Then** the result is identical and change notification is not emitted.
5. **Given** the same inputs on two different runtimes, **When** each resolves, **Then** the
   serialized results are byte-identical (NFR-001).

---

### User Story 4 - End user selects and personalizes within developer boundaries (Priority: P2)

Through whatever UI the host builds, an end user selects an available theme, adjusts permitted
customization points, previews a change, accepts or cancels it, and can reset to the developer
default. Their choices persist through a storage mechanism the host provides, survive theme
updates and switches where the Foundation says they do, and are never rewritten by enforcement.

**Why this priority**: Personalization is OpenTheme's differentiator (constitution II). It builds
on US1 and US3.

**Independent Test**: Replay the Foundation's US4 resolution examples through a Core controller
with an in-memory store, then inspect the store after each step. Pass if every resolved result
matches its fixture and the stored values change only on explicit user-intent operations.

**Acceptance Scenarios**:

1. **Given** a user value outside the effective constraints, **When** Core resolves, **Then** the
   value is clamped or falls back per Foundation FR-044, the preference status is `clamped` or
   `fell-back`, and the stored value is unchanged (FB-005).
2. **Given** a stored value that was clamped after the developer narrowed a range, **When** the
   developer widens it again, **Then** the original stored value applies (Foundation US4
   scenario 9).
3. **Given** a preference for a point that the policy does not permit, **When** Core resolves,
   **Then** the preference is skipped with `OT-CUS-103` and remains stored (FB-006).
4. **Given** a user previews an untrusted theme or a preference change, **When** the preview is
   active, **Then** the previewed result is available to the adapter and nothing is written to
   the store. **When** the user cancels, **Then** the prior result is restored exactly
   (constitution VI).
5. **Given** a user resets personalization, **When** Core resolves, **Then** the result equals
   resolving with the developer default theme and no preferences.
6. **Given** no store is configured, **When** the host uses every other capability, **Then** all
   of them work, and personalization lasts for the lifetime of the controller.
7. **Given** the store fails to read or write, **When** Core resolves, **Then** resolution still
   produces a valid result from the in-memory state, and the failure is reported to the host
   without affecting the applied appearance.

---

### User Story 5 - Output-target and adapter authors build on a stable, complete result (Priority: P2)

An output-target author converts Core's Resolved Theme into a platform representation, and an
adapter author binds Core to a framework. Neither needs to reimplement validation, resolution, or
policy.

**Why this priority**: Thin adapters are a constitutional requirement (V) and the purpose of
Core. It depends on US1.

**Independent Test**: Write a minimal test consumer that reads only Core's public surface. Pass if
it obtains every resolved value, the effective context, per-preference status, the accessibility
report, and diagnostics without touching Core internals, and if the public surface exposes no
framework, DOM, or platform type.

**Acceptance Scenarios**:

1. **Given** a Resolved Theme, **When** a consumer reads it, **Then** it contains exactly the
   members of `resolved-theme.schema.json` in the Foundation's units (dimensions in `px`, colors
   as quantized sRGB or system roles).
2. **Given** a consumer that needs the list of selectable themes with localized display text, and
   the effective customization points with their constraints and labels, **When** it asks Core,
   **Then** Core provides them computed by the same rules resolution uses (FR-043, FR-045).
3. **Given** a consumer subscribes to a controller, **When** any input changes the resolved
   output, **Then** it is notified exactly once with the new complete result, never with a
   partially updated one.

---

### User Story 6 - Versions evolve without silent incompatibility (Priority: P3)

Specification minors, theme versions, host declarations, and Core itself will change. Hosts need
Core to accept what it supports, reject what it does not, and keep preferences working across
theme updates.

**Why this priority**: Required before a stable Core release, but it does not block the first
integrations.

**Independent Test**: Run the versioning conformance fixtures through Core and a Core-level test
that registers two versions of one theme with stored preferences. Pass if outcomes match the
fixtures and Foundation US6.

**Acceptance Scenarios**:

1. **Given** a theme that targets a newer specification minor than Core supports, **When** it is
   admitted, **Then** it is unsupported with `OT-VER-002`, and it is never partially used.
2. **Given** a theme that targets an unsupported major, **When** it is admitted, **Then** it is
   unsupported with `OT-VER-001`, unless it is in the previous major's deprecation window, in
   which case it is migrated deterministically with `OT-VER-003`/`OT-VER-004` (FR-082).
3. **Given** a theme update removes a customization point that has a stored preference, **When**
   the new version resolves, **Then** the preference is skipped with `OT-CUS-104` and not deleted
   (FR-085).

---

### User Story 7 - Developers and coding agents fix problems from diagnostics alone (Priority: P3)

A host developer or an AI coding agent integrating Core receives structured, ordered,
machine-readable diagnostics for every rejected, clamped, skipped, or fallen-back input, and can
act on them without reading Core's source.

**Why this priority**: Required by constitution X and XI, and reuses the Foundation's diagnostic
model. It depends on US1 and US2.

**Independent Test**: For every invalid fixture and every Core operational failure, check that
the output is machine-readable, ordered deterministically, capped per chapter 13, and includes a
location and remediation.

**Acceptance Scenarios**:

1. **Given** a theme with more than 200 findings, **When** it is admitted, **Then** exactly 200
   diagnostics are returned in the chapter 13 order, followed by `OT-LIM-099` with the omitted
   count.
2. **Given** the same input twice, **When** diagnostics are produced, **Then** the lists are
   identical.
3. **Given** a failure that is not about theme or input data (for example, a storage failure or a
   missing trust level), **When** Core reports it, **Then** it is clearly distinguishable from
   specification diagnostics and never uses an invented `OT-*` code (FR-C083).

---

### Edge Cases

- The selected theme, the previous theme, and the developer default are all invalid: the
  specification baseline theme is applied (FB-001, FB-013). Core ships the baseline for every
  specification version it supports, and the baseline is always trusted.
- The previous theme's document is no longer registered: the fallback chain skips it and continues
  to the developer default (chapter 10).
- Two trusted documents share an identifier and version but have different integrity: both are
  kept distinct, `OT-SEC-002` is reported, and selection of that identifier and version fails
  closed into the fallback chain (chapter 12).
- A document is admitted twice with identical canonical content and trust: the second admission
  is idempotent and does not create a second entry.
- A base theme is unregistered or replaced after a child was admitted: validity depends on the
  current theme set (chapter 10), so the next resolution re-evaluates the chain. A child that
  becomes invalid falls back as a whole (FB-002).
- The host declaration changes: validation outcomes that depend on it are re-evaluated. Cached
  results for the old declaration are never reused (FR-C071).
- A preference value is not a literal of the declared type (for example, a reference or an
  expression): it resolves to the documented default with `OT-CUS-102` (FR-044), and the stored
  value is unchanged.
- The platform text scale is 250% and the allowed maximum is 200%: text resolves at 250%
  (FR-020).
- The platform reports `colorScheme: no-preference`: the Foundation's order applies (user choice,
  then platform, then default).
- The adapter reports the same context many times per second: Core returns identical results and
  emits no notification for unchanged output.
- A storage read returns data from a newer Core or preference format version that Core does not
  understand: Core does not guess. It treats the stored state as unavailable, reports it, and
  resolves as if no preferences were stored. It does not overwrite the stored data unless the user
  performs an explicit write.
- The host requests a very large number of admissions or resolutions: memory stays within the
  bounds the host configured (FR-C072, FR-C074).
- A cancelled or superseded asynchronous load completes late: its result never replaces a newer
  applied state.

## Requirements *(mandatory)*

### Functional Requirements

**Scope and dependencies**

- **FR-C001**: Core MUST be framework-agnostic and domain-agnostic. It MUST NOT depend on any UI
  framework, rendering library, DOM or browser API, styling language, platform storage API,
  network API, clock, randomness source, AI provider, analytics, or cloud service (constitution
  I, V, X, XII).
- **FR-C002**: Core MUST NOT execute, evaluate, or interpret any theme-provided or
  preference-provided content as code. Themes remain declarative data, and the only computation
  on theme data is the specification's closed transformation set (FR-018, FR-066).
- **FR-C003**: Core MUST NOT contain business logic, application-specific vocabulary, or concepts
  of any particular consumer. All vocabulary MUST come from the specification or be
  domain-neutral runtime terms (constitution I; FR-088).
- **FR-C004**: Core MUST NOT produce platform representations (CSS text, style objects, markup)
  and MUST NOT convert units beyond what the specification defines. Its sole resolution output is
  the Resolved Theme (constitution V).
- **FR-C005**: Core MUST be an independent implementation of the specification. It MUST NOT import,
  vendor, or derive its logic from the reference checker's source, so that SC-004 compares two
  independent implementations (research R18).

**Theme sources and admission (load → parse → validate → assign trust)**

- **FR-C010**: Core MUST define a Theme Source abstraction through which a host supplies theme
  documents (as bytes or text) from any origin it chooses. Core MUST NOT itself read files, fetch
  URLs, or access storage. Sources MAY complete asynchronously. Admission of already-obtained
  bytes MUST be available synchronously.
- **FR-C011**: Admission MUST apply the specification's untrusted-input pipeline in the
  specification's order: the size check before parsing, strict bounded parsing (I-JSON,
  duplicate-member detection, nesting checked during tokenization), schema and semantic
  validation, and resource limits (chapter 12; research R14, R15). Core MUST NOT relax, raise,
  or skip any limit, and hosts MUST NOT be able to configure specification limits.
- **FR-C012**: Admission MUST report all detectable errors in one pass, up to the chapter 13 cap
  (FR-061), and MUST finish with bounded effort for any input (FR-063).
- **FR-C013**: Admission MUST record, for each admitted document: its identifier, version,
  canonical integrity (FR-069), host-assigned trust level, validity outcome, and the diagnostics
  of the admission-time validation.
- **FR-C014**: Core MUST accept host declarations through the same kind of admission, validated
  against `host-declaration.schema.json` and chapter 17. An invalid host declaration MUST NOT be
  used.
- **FR-C015**: Core MUST preserve `$extensions` data without interpreting it (chapter 15).

**Trust boundary**

- **FR-C020**: Trust MUST enter Core only as an explicit, host-supplied value attached to each
  admission. Admission without a trust level MUST NOT proceed. Core MUST NOT default to trusted.
- **FR-C021**: Core MUST NOT infer, raise, or change trust from anything in or about the document:
  metadata, author, identifier (including reserved `org.opentheme.*` identifiers), version,
  provenance origin or lineage, `$extensions`, integrity, package contents, AI-generation flags,
  or the source's own claims (FR-010; chapter 15).
- **FR-C022**: Core MUST document that "trusted" means "bundled by the developer at build time"
  (constitution, Terminology) and that asserting trust for anything else is a host integration
  error. The specification baseline theme, shipped inside Core, is trusted.
- **FR-C023**: Trust MUST propagate as the Foundation defines: a resolved theme's trust is the
  lowest trust in its inheritance chain (FR-048). An untrusted entry never replaces, shadows, or
  is presented as a trusted entry with the same identifier (FR-068, FB-010).
- **FR-C024**: Core MUST provide host settings that allow untrusted themes per source category:
  `user-created`, `imported`, `shared`, and `ai-generated`. Every category MUST be off by
  default (constitution III). These are Core host settings. They are not part of the resolution
  input and do not change the Foundation's resolution contract.
- **FR-C026**: Every untrusted admission MUST state its source category, supplied by the host from
  how it obtained the document. Admission MUST be refused, with an operational report
  (FR-C083), and the document not registered, when the category is missing, unknown, or not
  allowed. Core MUST NOT read, infer, or check the category from the document's `provenance`
  or any other content. A document whose provenance disagrees with the stated category is not
  an error and gains nothing. Trusted admissions have no source category and are not affected.
- **FR-C027**: If the host turns a source category off after documents from it were admitted,
  those entries MUST stop being selectable from the next snapshot on. A selection that pointed at
  one falls back per FB-001, and stored preferences are not modified (FR-C063). Allowing a
  source does not make its themes selectable by itself: they must still be available under the
  policy (`availableThemes`, chapter 10).
- **FR-C028**: By default, Core MUST refuse admission of an untrusted theme that is valid but has
  any declared pair below its WCAG 2.2 AA threshold (`OT-A11Y-003`) in any mode it supports,
  evaluated as the Foundation's accessibility report defines (FR-064; chapter 11) with the
  active host declaration and the theme's resolved inheritance chain (constitution VIII). The
  refusal is an operational error (FR-C083), and the `OT-A11Y-003` diagnostics are returned
  unchanged. A host setting MAY relax this gate explicitly. A relaxed admission still returns
  every shortfall diagnostic. Trusted themes are never refused by this gate; their shortfalls
  are reported only (FR-064). When the host declaration or a base theme changes, the gate is
  re-evaluated for the affected entries, and an entry that now fails stops being selectable.
  The gate runs before resolution, so the Foundation's resolution contract is unchanged.
- **FR-C025**: Untrusted documents MUST pass exactly the same validation and resolution rules as
  trusted ones. There is no relaxed or AI-specific path (FR-097; constitution VII).

**Theme registry**

- **FR-C030**: Core MUST provide a Theme Registry that holds admitted theme documents and at most
  one active host declaration, and always contains the specification baseline theme for each
  supported specification version.
- **FR-C031**: The registry MUST keep entries with the same identifier distinct by trust and by
  `(id, version, integrity)`. It MUST apply the identity rules of chapter 12 (`OT-SEC-001`,
  `OT-SEC-002`) and MUST NOT overwrite one entry with another.
- **FR-C032**: Resolution MUST operate on an immutable snapshot of the registry. Admissions or
  removals after a snapshot is taken MUST NOT change any result computed from that snapshot.
- **FR-C033**: Registering an invalid document MUST be possible so that its diagnostics can be
  reported, but an invalid entry MUST never be selectable or applied in any part (FR-065).
- **FR-C034**: When several versions of one identifier are selectable and a selection names no
  version, the version with the highest SemVer precedence MUST be chosen, regardless of
  registration or input order. Only versions available under the policy, and not shadowed under
  the identity rules of chapter 12, count. If the chosen version is invalid or unsupported, the
  FB-001 fallback chain applies (previous, then developer default, then baseline). Core MUST NOT
  search older versions of the same identifier. This is selection behavior, so it MUST be
  recorded as a Foundation errata before Core implements it: chapter 10 text, at least one
  conformance fixture, and the matching reference-checker fix. Core MUST NOT ship a rule that
  differs from the Foundation.

**Selection, inheritance, and fallback**

- **FR-C040**: Selection, inheritance, and fallback MUST follow chapter 10 exactly: selected, then
  previous, then developer default, then specification baseline; bases resolved from the same
  theme set; merge base-first; depth, cycle, and version-range rules; and the `OT-INH-*`,
  `OT-RES-*`, and `OT-SEC-*` codes.
- **FR-C041**: Validity used for selection MUST be the validity of the selected document and its
  chain under the snapshot's current theme set and host declaration, even if admission-time
  validation used a different set. Core MAY reuse admission-time results only when they are
  guaranteed identical (FR-C071).
- **FR-C042**: Core MUST expose the list of selectable themes for a snapshot and policy (entries
  that are valid, available under policy, and not shadowing a trusted identifier), with display
  text localized per Foundation US3 scenario 1.

**Context model**

- **FR-C050**: Core MUST accept context as two explicit, injected, platform-neutral inputs that
  mirror the resolution input schema exactly:
  - **Platform accessibility and appearance**: color scheme (`light`, `dark`, `no-preference`),
    contrast (`standard`, `high`), forced colors, reduced motion, and the text-scale factor;
  - **Environment**: size class (`compact`, `medium`, `expanded`), locale (BCP 47), and writing
    direction (`ltr`, `rtl`).
- **FR-C051**: Core MUST NOT read any of these values from the platform itself. Adapters translate
  platform or framework state into this model (constitution X). Core MUST NOT accept pixel widths
  or compute size classes. The host supplies the size class (FR-038).
- **FR-C052**: Core MUST NOT add context inputs that the Foundation does not define. In
  particular, density is a customization point and theme default in the Foundation (chapter 6),
  not a platform or environment input, so Core MUST NOT accept density as context.
- **FR-C053**: Invalid context values MUST be rejected by Core with a report to the caller. Core
  MUST NOT substitute guessed values. Invalid context values are caller errors and are reported
  as operational errors (FR-C083).

**Developer policy and user preferences**

- **FR-C060**: Core's runtime policy and preference models MUST be exactly the abstract `policy`
  and `preferences` members of the resolution input (available themes, default theme, permitted
  points with narrowed constraints and defaults, allowed color schemes, locks, protected paths,
  accessibility floor; point id to literal value). Core MUST NOT add precedence semantics to
  them. The developer policy reaches Core only as this abstract, host-supplied contract or as a
  preset (FR-C065). A Customization Policy *document* format is out of scope for this feature.
- **FR-C061**: Core MUST validate policy and preferences before use, with the Foundation's codes
  and `input` locations (for example, a mistyped lock is ignored with `OT-TOK-004`; a narrowing
  that excludes the default without a replacement is `OT-CUS-001`).
- **FR-C062**: Core MUST apply preferences only through Foundation FR-044 enforcement at the
  specification's stage, and MUST report per-point status (`effective`, `clamped`, `fell-back`,
  `skipped`, `rejected`) in the Resolved Theme.
- **FR-C063**: Enforcement, fallback, accessibility-floor rejection, theme switches, theme updates,
  and policy changes MUST NOT modify, delete, or rewrite stored preference values (FR-044, FB-005
  to FB-007). Only an explicit user-intent operation (set, clear, reset, accept preview) may
  change stored values.
- **FR-C064**: Policy MUST remain above user preferences and platform accessibility MUST remain
  above both, exactly as FR-050 to FR-053 define. No Core option may change this order.
- **FR-C065**: Core MUST provide at least two documented policy presets as data that compile to the
  abstract policy: a **closed default** (only registered trusted themes; no permitted points; AA
  floor) and a **common personalization** preset that permits the seven standard customization
  points within registry constraints and keeps the AA floor. This is how the "single documented
  setting" of constitution III is met. Presets MUST NOT be able to express anything the abstract
  policy cannot.
- **FR-C067**: This feature MUST define the **User Preferences document** as a new, versioned
  public contract, delivered like any contract change (constitution, Contract changes): a
  schema, normative rules, conformance fixtures (valid, invalid, and malicious), a version, and a
  changelog entry. It adds new Foundation artifacts and changes no existing expected result
  (see the allowed Foundation prerequisites in Product Boundaries). The document:
  - is declarative data that contains only the user's selection, the last valid applied theme
    `(id, version)`, and customization point values as literals keyed by point id. It MUST NOT
    contain theme data, policy, host data, or anything the specification's forbidden-content
    rules forbid (FR-066, FR-095);
  - declares its own format version with SemVer, independent of the Theme Specification and of
    Core (constitution IX);
  - compiles losslessly into the `selection`, `previous`, and `preferences` members of the
    resolution input, and Core MUST NOT give it any meaning beyond that;
  - is always untrusted input (findings use `OT-PREF-*` codes, FR-C069): it MUST be
    size-limited before parsing, strictly parsed, and
    validated before use, and an invalid document is never partially used (FR-C093);
  - is never rewritten by enforcement: stored values that are clamped, fall back, are skipped, or
    are rejected stay exactly as stored (FR-C063).
- **FR-C068**: Core MUST read User Preferences documents of every supported format version,
  migrate earlier versions deterministically with diagnostics for lossy changes, and treat a
  document of a newer or unsupported version as unavailable without overwriting it (FB-C003).
  Core MUST be able to export the current preferences as a document and import one, and import
  goes through the same validation.
- **FR-C066**: Core MUST expose, for a theme, snapshot, and policy, the effective customization
  points (theme-declared ∩ permitted) with their type, effective constraints, documented default,
  and localizable labels (FR-043, FR-045), computed by the same logic resolution uses.

**Resolution**

- **FR-C070**: Core MUST provide a pure resolution operation whose input is a registry snapshot
  plus a Resolution Request (selection, previous applied theme, platform, environment,
  preferences, policy). It MUST compile losslessly into the Foundation's resolution input and
  MUST produce a Resolved Theme and diagnostics identical to the normative algorithm (chapter 10;
  research R12). It MUST run synchronously once the snapshot exists, and MUST NOT perform I/O.
- **FR-C071**: Core MAY memoize validation and resolution internally. Memoization MUST be invisible:
  results, diagnostics, and their order MUST be byte-identical with memoization enabled or
  disabled. A cache key MUST cover every input that can affect the output: the canonical
  integrity and trust of every theme document in the snapshot that selection or inheritance can
  reach, the host declaration's integrity, the supported specification version and registries,
  and the canonical (JCS) form of selection, previous, platform, environment, preferences, and
  policy.
- **FR-C072**: The host MUST be able to bound memoization memory and to disable memoization.
  Eviction MUST NOT affect results. Core MUST NOT expose cache contents, hit status, or cache
  keys as part of any result.
- **FR-C073**: Core MUST NOT offer any public caching API beyond FR-C072 in this feature. Output
  targets and adapters MUST NOT need to cache resolution to meet NFR-C001.
- **FR-C074**: The host MUST be able to bound the number of registry entries. Hitting the bound
  refuses further admissions with a report and never evicts a trusted entry silently. These are
  runtime memory bounds, not specification limits, and they never change a document's validity.

**Stateful controller (optional convenience over pure resolution)**

- **FR-C080**: Core MUST provide an optional Theme Controller that holds, for one scope, the
  current registry snapshot, policy, context, selection, preferences, and last valid applied
  theme, and publishes the current Resolved Theme. Every published result MUST equal the pure
  resolution of the controller's current inputs.
- **FR-C081**: The controller MUST support: changing context, selection, preferences, policy, and
  registry; preview with explicit accept or cancel; reset to the developer default; and change
  subscription with one complete result per effective change. Previews MUST NOT write to
  persistence (constitution VI).
- **FR-C082**: The controller MUST update "previous" only to a theme that was actually applied
  without fallback, so the FB-001 chain is meaningful. Several independent controllers MUST be
  able to coexist, for example for different regions of one application, without shared mutable
  state.
- **FR-C083**: Core MUST report failures that are not findings about a document (a missing trust
  level, a missing, unknown, or disallowed untrusted source category, invalid context values or
  other invalid API calls, a source or storage failure, a registry capacity bound, a superseded
  load) as **operational errors**. Operational errors:
  - use a closed vocabulary of error kinds that Core defines and versions with its public API
    (FR-C102). Kind identifiers MUST NOT use the `OT-` prefix, so they can never be mistaken for
    specification diagnostic codes;
  - are machine-readable and include the kind, the operation, the location in the caller's input
    where applicable, a plain-language message, and a remediation hint;
  - MUST NOT reproduce untrusted document content (FR-C086) and never change validity or the
    applied appearance.
- **FR-C069**: Findings about a User Preferences document (malformed or oversized document,
  unknown members, wrong value shapes, unsupported or newer format versions, lossy migration)
  MUST be specification diagnostics with new codes in a new `PREF` area of
  `specification/registry/1.0/diagnostics.json` (`OT-PREF-*`) and matching `R-PREF-*` rules,
  added through the contract-change process with fixtures (FR-C067). Existing codes and rules
  MUST NOT change.

**Diagnostics**

- **FR-C084**: Specification diagnostics produced by Core MUST use only codes from
  `diagnostics.json`, conform to `diagnostic.schema.json`, and follow chapter 13's ordering and
  cap (200, then `OT-LIM-099`). Core MUST NOT invent `OT-` codes.
- **FR-C085**: Core MUST keep severities as the registry defines them: `error` affects validity,
  and resolution findings (clamp, fallback, skip, rejection) are `warning` or `info`. Core MUST
  NOT drop, merge, downgrade, or hide diagnostics. A result with fallback MUST say so in both
  `applied.fallback` and the diagnostics.
- **FR-C086**: Diagnostic parameters MUST contain only grammar-constrained values and never
  reproduce untrusted free text (FR-071; research R13). Message and hint templates MUST remain
  localizable identifiers, with registry English templates available to hosts.
- **FR-C087**: Core MUST distinguish four outcomes in every resolution result: successful
  resolution of the selected theme; resolution with preference-level adjustments (clamped,
  fell back, skipped, rejected); resolution through theme fallback; and admission rejection.

**Persistence**

- **FR-C090**: Core MUST define a minimal, injectable Preference Store abstraction for reading,
  writing, and clearing one scope's User Preferences document (FR-C067). It MUST allow asynchronous implementations.
- **FR-C091**: Core MUST work fully with no store. It MUST ship an in-memory store for tests and
  quick starts. It MUST NOT ship or hard-code implementations that use platform storage (for
  example, browser storage, databases, files, or cookies). Those belong to adapters or hosts.
  [Constitution II requires "at least one local (on-device) implementation"; this spec assumes an
  adapter-level package satisfies it (Assumptions).]
- **FR-C092**: The host MUST be able to supply initial personalization state synchronously (for
  example, read during server rendering), so the first resolution does not wait for the store.
- **FR-C093**: Core MUST NOT transmit preferences anywhere on its own (constitution II). Store
  failures MUST NOT block or alter resolution. Stored data MUST be treated as untrusted input and
  validated before use.

**Resource limits**

- **FR-C095**: Core MUST enforce every limit in `limits.json` with its code, fail closed, and use
  no partial results (FB-008). Effort budgets (for example, 200,000 derivation units per mode)
  MUST be counted exactly as the specification defines, so every implementation reaches the same
  outcome.

**Versioning and compatibility**

- **FR-C100**: Core MUST declare the specification versions it supports as MAJOR.MINOR. It MUST
  accept `M.0` through its supported `M.N`, reject newer minors with `OT-VER-002` and unsupported
  majors with `OT-VER-001`, and never partially use such documents (FR-081; chapter 14).
- **FR-C101**: Core MUST accept previous-major documents only through the specification's
  migration manifests during the published deprecation window, with `OT-VER-003`/`OT-VER-004`
  (FR-082). A migrated document keeps the trust of the original admission.
- **FR-C102**: Core's public API MUST be versioned with SemVer independently of the specification
  (constitution V, IX). Removing support for a specification major, or any breaking API change,
  requires a Core major. Adding support for a new specification minor is a Core minor.
  Deprecations MUST be announced one minor ahead and produce diagnostics or operational warnings
  while in effect.
- **FR-C103**: Core MUST NOT publish a stable (1.0.0 or later) release while the specification it
  implements is a draft (`1.0.0-draft.N`), because drafts carry no compatibility guarantee
  (FR-079).
- **FR-C104**: Core's public types MUST be generated from, or verified against, the specification
  schemas (constitution XI).

**Document utilities required by the resolver conformance class**

- **FR-C110**: Core MUST implement every operation of the *resolver* conformance class (chapter
  00): validate, resolve, canonicalize, flatten, compare-versions, migrate, and kernel, plus
  validate-host and export-check as the runner protocol defines them. Canonicalization and
  integrity, flattening, export eligibility, version comparison, and migration MUST be exposed as
  public document utilities. Numeric kernels MUST stay internal and be reachable only through the
  conformance harness.
- **FR-C111**: Core MUST ship a conformance harness that speaks the Foundation's NDJSON runner
  protocol, so the unchanged runner can drive Core with `--impl`.

### Non-Functional Requirements

- **NFR-C001 Performance**: Core MUST meet at least the Foundation's budgets (research R22;
  NFR-003; SC-010), measured the same way: on a CI x86-64 runner, validate and resolve a typical
  theme (1,000 tokens) in a median of 25 ms or less, an at-limit theme in 250 ms or less; reject a
  10 MiB document in 5 ms or less; and re-resolve after a context change in 4 ms or less. On the
  named mid-range phone: 100 ms and 1 s. Preference changes use the same re-resolution budget as
  context changes. A repeated resolution with identical inputs MUST NOT be slower than a
  re-resolution. Bundle-size budgets are set in the plan (research R22 assigns them to this
  feature).
- **NFR-C002 Determinism**: For identical inputs, Core MUST produce byte-identical JCS results
  and diagnostic lists across runs, runtimes, memoization settings, registry insertion orders
  (except where the specification makes order significant), and controller histories that lead
  to the same inputs.
- **NFR-C003 Offline**: Every capability MUST work with no network, account, or external service
  (constitution XII).
- **NFR-C004 Portability**: Core MUST run in server, browser, and mobile JavaScript runtimes
  without platform-specific APIs, and MUST NOT rely on platform math for normative computation
  (the specification's numeric kernels, research R7).
- **NFR-C005 Security review**: Changes to Core's parsing, limit enforcement, admission,
  serialization, trust handling, or stored-state reading MUST include malicious fixtures and a
  recorded security-focused review (constitution VI).
- **NFR-C006 Agent-friendly surface**: Core MUST ship typed API reference, JSON Schemas it
  consumes, and an agent-oriented guide covering integration, trust, and common mistakes.
  Documentation examples MUST run in CI (constitution XI).
- **NFR-C007 Privacy**: Core MUST NOT collect telemetry and MUST NOT include host application data
  in any result or diagnostic.
- **NFR-C008 Bounded memory**: Registry entries and memoization MUST stay within host-configured
  bounds (FR-C072, FR-C074).

### Failure Behavior

Core adds no new fallback rules. It applies the Foundation's FB-001 to FB-013 and adds only
runtime-state rules:

| Situation | Behavior | Source |
|---|---|---|
| Invalid theme | Not registered as selectable; if selected, the whole theme falls back | FB-001, FR-065 |
| Unsupported version | Unsupported, never partly used; `OT-VER-001`/`002` | FR-081 |
| Invalid preference | Clamp or fall back per point; others apply; stored value unchanged | FB-005 |
| Unavailable or unpermitted point | Skipped, stored value kept | FB-006, `OT-CUS-103`/`104` |
| Theme unavailable under policy | Treated as missing; fallback chain | chapter 10, `OT-RES-004` |
| Invalid inheritance | Child invalid; fallback | FB-002 |
| Invalid reference or derivation | Theme invalid; fallback | FR-059 |
| Accessibility floor | User values a failing pair depends on are rejected; one re-run | FB-007, `OT-A11Y-007` |
| Policy conflict (mistyped lock, invalid narrowing) | Reported at `input`; handled as chapter 10 and 9 define | `OT-TOK-004`, `OT-CUS-001` |
| Resource limit | Rejected with bounded effort, no partial results | FB-008 |
| Trust collision | Untrusted kept distinct; trusted wins | FB-010 |
| Missing trust at admission (**FB-C001**) | Admission does not proceed; reported to host | FR-C020 |
| Untrusted source category missing, unknown, or not allowed (**FB-C005**) | Admission refused; nothing registered; reported to host | FR-C024, FR-C026 |
| Source category turned off after admission (**FB-C006**) | Its entries stop being selectable; selection falls back per FB-001 | FR-C027 |
| Untrusted theme below AA with the gate on (**FB-C007**) | Admission refused; shortfall diagnostics returned; nothing registered | FR-C028 |
| Store read or write failure (**FB-C002**) | Resolution continues from in-memory state; reported | FR-C093 |
| Stored state unreadable or unknown version (**FB-C003**) | Treated as absent; not overwritten without explicit user write | Edge Cases |
| Superseded asynchronous load (**FB-C004**) | Never replaces a newer applied state | Edge Cases |

In every case the applied appearance is either the new complete result or the prior complete
result. There is never a mixture (FR-065).

### Product Boundaries and Out of Scope

- Out of scope: React and every other adapter; DOM; CSS or any output target; framework state;
  UI components; appearance settings UI; theme picker; Theme Builder; marketplace; sharing flows;
  theme package container; AI capabilities; cloud services; analytics; application databases,
  APIs, routing, authentication, or payments; business logic; and consumer-specific concepts,
  including Nisha.
- Out of scope: any change to the Foundation's normative artifacts, **except** these additive
  Foundation prerequisites (research.md P1–P4), each delivered as its own contract change
  with prose, schema, fixtures, a CHANGELOG entry, and a green `pnpm verify`:
  - **P1**: the chapter 10 rule for unversioned selection (clarification 4, FR-C034), with its
    fixtures and the reference-checker fix;
  - **P2**: the conformance runner sends sweeps through the protocol to any `--impl` (F11);
  - **P3**: the User Preferences contract: chapter 18, schema, `OT-PREF-*` codes, `R-PREF-*`
    rules, fixtures, the `validate-preferences` runner kind, and reference-checker support
    (FR-C067–FR-C069);
  - **P4**: agent documentation (`AGENTS.md`, `llms.txt`).
  No prerequisite may change an existing expected result, except as a documented bug fix under
  the Foundation's compat-freeze rule. Any other Foundation finding is recorded below for a
  separate errata change.
- This feature is a specification. Planning, implementation, and packages follow later Spec Kit
  steps.

### Key Entities

- **Theme Source**: A host-provided producer of theme or host-declaration documents. Core never
  performs its I/O.
- **Admission**: The act of parsing, validating, and recording one document with its
  host-assigned trust. The result is a registry entry and diagnostics.
- **Trust Level**: `trusted` or `untrusted`, supplied by the host per admission; propagates as the
  minimum along an inheritance chain.
- **Untrusted Source Category**: `user-created`, `imported`, `shared`, or `ai-generated`,
  supplied by the host with each untrusted admission and allowed per category by host settings
  (all off by default). Never derived from the document.
- **Theme Registry / Snapshot**: The set of admitted documents plus the host declaration and the
  built-in specification baseline. Snapshots are immutable inputs to resolution.
- **Registry Entry**: `(id, version, integrity, trust, validity, admission diagnostics)`.
- **Customization Policy (runtime model)**: The abstract resolution-input `policy`; presets
  compile to it.
- **User Preferences Document**: The versioned, serializable document that holds one scope's
  selection, last valid applied theme, and customization point values (FR-C067). It compiles
  into the runtime model below.
- **User Preferences (runtime model)**: The abstract resolution-input `preferences` map, plus the
  user's selection. Stored values are never rewritten by enforcement.
- **Platform Context / Environment Context**: The injected `platform` and `environment` members of
  the resolution input.
- **Resolution Request**: The runtime inputs that, together with a snapshot, compile losslessly
  into the Foundation's resolution input.
- **Resolved Theme**: The Foundation's `resolved-theme.schema.json` output, unchanged.
- **Diagnostic**: The Foundation's `diagnostic.schema.json` object, unchanged.
- **Operational Error**: A Core report of a failure that is not a finding about a document, from a
  closed, Core-versioned vocabulary without the `OT-` prefix (FR-C083).
- **Theme Controller**: An optional stateful scope that publishes resolution results for current
  inputs and supports preview, accept, cancel, reset, and subscription.
- **Preference Store**: The injectable persistence abstraction for one scope's personalization
  state.
- **Policy Preset**: Named, documented policy data that compiles to the abstract policy.

## Public API Concepts

These are responsibilities, not signatures. Names and exact shapes are settled in the plan. Every
concept's inputs and outputs are data defined by the Foundation's schemas or by this spec's Key
Entities.

| Concept | Purpose | Inputs | Outputs | Invariants | Failure behavior | Determinism |
|---|---|---|---|---|---|---|
| Admit | Parse, validate, and record a document | bytes or text, trust level, source category (untrusted only), document kind (theme or host) | registry entry, diagnostics | trust is required; limits before parse; no partial records | rejection with diagnostics; FB-C001 | same bytes and trust give the same entry and diagnostics |
| Registry and snapshot | Hold admitted documents | admissions, removals, capacity bound | immutable snapshot; selectable theme list | baseline always present; identity rules of chapter 12 | capacity refusal reported | snapshot contents independent of wall-clock time |
| Resolve | Run the normative algorithm | snapshot, Resolution Request | Resolved Theme, diagnostics | pure, synchronous, no I/O; complete result | fallback per FB-001; never partial | byte-identical JCS output |
| Describe customization | Effective points for UI | snapshot, theme id, policy, locale | points with constraints, defaults, labels | same logic as resolution | unknown theme reported | deterministic |
| Policy presets | One-setting adoption | preset name | abstract policy | cannot express more than the abstract policy | unknown preset reported | fixed data |
| Theme Controller | Stateful scope for adapters | snapshot, policy, context, store (optional) | current Resolved Theme, change notifications | output = pure resolve of current inputs; previews never persist | store failures isolated | one notification per effective change |
| Preference Store | Persistence seam | read, write, clear | stored state | only explicit user intent writes | failures reported, never block | not applicable |
| Document utilities | Canonicalize, integrity, flatten, export-check, compare-versions, migrate | documents, manifests | as the runner protocol defines | same as conformance | diagnostics | byte-identical |
| Conformance harness | Drive Core from the runner | NDJSON protocol | NDJSON protocol | data only | per protocol | per protocol |

Versioning expectations apply to every concept per FR-C102. The shape of any data defined by a
Foundation schema follows that schema's version, not Core's.

## Core Lifecycle and Data Flow

The requested lifecycle maps onto the Foundation's stages as follows. Core does not introduce a
second order: steps 1 to 5 happen at admission and registry time, and steps 6 to 12 are the
normative resolution stages of chapter 10, run in their normative order.

| # | Requested step | Where it happens | Normative source |
|---|---|---|---|
| 1 | Load | Theme Source (host I/O) | FR-C010 |
| 2 | Parse | Admission: size check, bounded I-JSON parse | chapter 12; R14 |
| 3 | Validate | Admission: schema, semantics, limits | chapters 01–15; FR-059 |
| 4 | Assign trust | Admission: host-supplied value only | FR-010; chapter 15 |
| 5 | Register | Registry: identity rules; snapshot | chapter 12 |
| 6 | Select, including inheritance | Stage 1 **Select**: chain validated against the snapshot; fallback | chapter 10 stage 1 |
| 7 | Environment and context | Stage 2 **Context**: effective color scheme, contrast, motion, density, size class | chapter 6 |
| 8 | User preferences | Stage 3 **Declare**, layer 3, after FR-044 enforcement | chapter 9 |
| 9 | Developer policy | Stage 3 **Declare**, layer 4: locks and protected paths | chapter 10 |
| 10 | Resolve | Stage 4 **Evaluate**: aliases and derivations over the layered graph | R12 |
| 11 | Accessibility processing | Stage 5 **Post-process** (layer 5: text scale, target size, forced colors, reduced motion, RTL), stage 6 **Quantize**, stage 7 **Check** (floor and one re-run) | chapters 10, 11 |
| 12 | Produce result and diagnostics | Resolved Theme with `applied`, `context`, `preferences`, `accessibility`, `diagnostics` | resolved-theme schema; chapter 13 |

Note: platform accessibility (layer 5) is applied after policy, and the accessibility-floor check
comes after quantization and may re-run stages 3 to 7 once. The requested list places
"accessibility processing" after "resolve"; that matches the Foundation only in this sense.

```text
Host I/O ──bytes──▶ Admit(trust) ──entry──▶ Registry ──snapshot──┐
Adapter ──platform/environment context──────────────────────────┤
Host ──policy or preset──────────────────────────────────────────┤──▶ Resolve (pure, sync)
Store / initial state ──selection, previous, preferences─────────┘        │
                                                                          ▼
                                  Resolved Theme + diagnostics ──▶ Output target ──▶ Adapter
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-C001**: Core, driven by the unchanged conformance runner through its harness, passes 100%
  of the conformance fixtures (227 at the time of writing) as a *resolver*-class implementation,
  plus the seed and accent sweeps, with zero "unsupported" results.
- **SC-C002**: Core and the reference checker produce byte-identical results for 100% of fixtures
  and sweep cases. This completes the Foundation's cross-feature gate SC-004.
- **SC-C003**: Across two distinct runtime environments, with memoization on and off and with
  randomized registry insertion order, 100% of resolution fixtures produce byte-identical
  results.
- **SC-C004**: The quickstart (install, register bundled themes, choose a preset, resolve) needs
  no theme values and no configuration beyond those steps, and runs as an automated CI test.
- **SC-C005**: Across 100% of invalid and malicious fixtures, applied through admission and
  through a controller with a valid theme already applied, there are zero cases of partial
  application and zero changes to the previously applied result.
- **SC-C006**: Across 100% of US4 resolution fixtures and store-failure tests, stored preference
  values change only on explicit user-intent operations: zero rewrites by enforcement, fallback,
  previews, or theme changes.
- **SC-C007**: A property test over at least 1,000 generated documents finds zero cases where any
  change to metadata, identifier, provenance, author, version, or extensions changes the trust
  level Core reports.
- **SC-C008**: Core meets every NFR-C001 budget in CI benchmarks.
- **SC-C009**: A dependency and API audit finds zero framework, DOM, browser, storage, network,
  clock, or randomness dependencies in Core, and zero public types that name them.
- **SC-C010**: Under a stress test of 10,000 admissions and 100,000 resolutions, memory stays
  within the configured registry and memoization bounds.
- **SC-C011**: 100% of Core operational failure kinds have a documented, machine-readable report
  with a location and a remediation, verified by tests.
- **SC-C012**: With default host settings, 100% of untrusted admissions in the test suite are
  refused. With a category allowed, 100% of admissions stated as another category are refused,
  whatever the documents' provenance claims.
- **SC-C013**: With default settings, 100% of untrusted test themes that have an AA shortfall in
  any supported mode are refused at admission, and 0% of trusted themes are refused for
  accessibility shortfalls.

## Testing and Conformance Strategy

- **Reuse first**: the full Foundation suite (fixtures, sweeps, kernel vectors) runs against Core
  through the runner protocol, unchanged. Its expected outcomes are the only authority on
  resolution behavior. Core adds no fixtures that redefine specification behavior.
- **Cross-implementation agreement**: CI compares Core and the reference checker byte for byte
  (SC-C002). A disagreement is a defect in one of them, resolved against the specification. A
  specification bug goes through the Foundation's errata process, not a Core workaround.
- **Core-only suites** (for behavior the Foundation does not cover):
  - public API contract tests for every concept in Public API Concepts;
  - trust tests: required trust, no inference (SC-C007), chain minimum, collision handling;
  - admission-gate tests: per-source settings (SC-C012) and the accessibility gate (SC-C013);
  - User Preferences document tests: valid, invalid, malicious, migration, and `OT-PREF-*` codes;
  - registry and snapshot isolation, idempotent admission, and capacity bounds;
  - controller tests: preview, accept, cancel, reset, subscription, previous tracking, and
    independent scopes;
  - persistence tests with an in-memory store and failure-injecting fakes (FB-C002, FB-C003);
  - memoization-equivalence tests (on and off, eviction pressure);
  - determinism tests across runtimes and insertion orders (SC-C003);
  - malicious-input tests at admission and for stored state (NFR-C005);
  - version tests: supported range, newer minor, unsupported major, simulated previous major;
  - benchmarks for NFR-C001 and a dependency audit for SC-C009.
- **Downstream**: the adapter conformance suite (constitution V) is a later feature and must use
  Core as its oracle.

## Foundation Alignment Findings

These were found while reading the Foundation. None has been changed. Each needs a decision
before or during planning.

| # | Finding | Evidence | Core's interim position |
|---|---|---|---|
| F1 | **Resolved (2026-09-25).** `resolution-input.schema.json` lacked `themes` and had an identifier-keyed `trustedIds`, unlike the contract, chapter 15, and fixtures. | CHANGELOG "Unreleased (errata to 1.0.0-draft.1)"; security review S8 | The schema now requires per-document `themes[].trust`; `trustedIds` and trust-less `bases` were removed; spec-lint checks resolve fixture inputs against the schema. |
| F2 | **Resolved (2026-09-25).** The reference checker defaulted missing trust to trusted and let an untrusted entry listed first deny a trusted one. | security review S9–S11 | Fixed in `select.ts`; covered by four new negative fixtures and unit tests. Core still requires explicit trust (FR-C020). |
| F3 | **Resolved by clarification (2026-09-25).** No policy member for allowing untrusted themes, although constitution III requires closed defaults per kind. | constitution III; `resolution-input.schema.json` `policy` | Per-source Core host settings, all off by default (FR-C024, FR-C026, FR-C027). No Foundation change. |
| F4 | **Resolved by clarification (2026-09-25).** No policy member decided whether an accessibility-nonconformant theme may be used (FR-064), while constitution VIII requires that the default prevent untrusted themes below AA. | Foundation FR-064; chapter 10; constitution VIII | Core admission gate for untrusted themes, on by default and explicitly relaxable; trusted themes are reported only (FR-C028). No Foundation change. |
| F5 | **Decided by clarification (2026-09-25); Foundation errata pending.** Unversioned selection with several registered versions had no normative rule, and the reference checker picks the last one inserted (order-dependent, against NFR-001). | chapter 10; `select.ts` `pickEntry` | Highest SemVer precedence, then normal fallback (FR-C034). Needs a chapter 10 errata, a fixture, and a reference-checker fix before Core implements it. |
| F6 | **Resolved by clarification (2026-09-25).** The registry had no codes for runtime failures, and AGENTS.md forbids inventing codes. | `diagnostics.json`; AGENTS.md invariant 4 | Runtime and API failures are Core operational errors without the `OT-` prefix (FR-C083). User Preferences document findings get new `OT-PREF-*` registry codes through the contract-change process (FR-C069). |
| F7 | **Density and viewport in the requested context model.** The request lists density and viewport as platform or environment inputs. The Foundation models density as a customization point or theme default, and size class as host-supplied. | chapter 6; FR-038 | Core does not add them (FR-C051, FR-C052). |
| F8 | **Resolved by clarification (2026-09-25).** The Foundation deferred the Policy and Preferences document formats, while constitution II requires a versioned, serializable preferences document. | Foundation Out of Scope; constitution II | This feature defines the User Preferences document (FR-C067, FR-C068). The Customization Policy document format stays a later feature; Core accepts the abstract policy and presets (FR-C060, FR-C065). |
| F9 | **"Previous" is only `(id, version)`** in the input. The fallback chain works only if the host keeps that document registered. | chapter 10; schema `previous` | Controller tracks it (FR-C082); a missing previous document is skipped (Edge Cases). |
| F10 | **Constitution III's "single documented setting (preset policy)"** is not defined by the Foundation. | constitution III | Core defines presets as data compiling to the abstract policy (FR-C065). This is additive and non-normative. |
| F11 | **Runner sweeps bypassed the protocol** and called the reference checker in-process, so no other implementation could be swept. | `conformance/runner/src/sweeps/*` | **Fixed (P2):** `--sweeps --impl` sends every request over the protocol. The default is unchanged. |
| F12 | **Reference-checker benchmark budgets are relaxed proxies** (40 ms and 25 ms) rather than R22's 25 ms and 4 ms. | `tools/bench/src/node.ts` | Core's benchmark enforces R22 (NFR-C001). The reference-checker bench is unchanged. |
| F13 | **"Pointer canonical order" (chapter 13) is undefined**, and the reference checker sorts pointers with `localeCompare`, which depends on the locale. | `specification/spec/13-diagnostics.md`; `tools/reference-checker/src/diagnostics/collector.ts` | **Fixed (errata, 2026-09-25):** chapter 13 defines UTF-16 code-unit order, the reference checker uses it, and no expected result changed. |
| F14 | **The generated types index exported names that do not exist** (types are named from the schema `title`), and nothing type-checked it. | `tools/types/scripts/generate.ts` | **Fixed:** the index exports each root type under its file name. `Seeds.ts` still fails to type-check (a pre-existing json-schema-to-typescript limitation); not used by Core. |
| F15 | **`kernel` requests carried no inputs**; the reference checker read its own copy of the fixture file. | `conformance/runner/src/main.ts` | **Fixed:** the runner sends the input vectors (never the expected outputs). |
| F16 | **199 kernel golden vectors are mathematically wrong** (22 `cbrt`, 1 `log2`, 176 `exp2`). Root cause: `TWO_60` is `0x43C0000000000000` (2⁶¹, should be 2⁶⁰), and subnormal `frexp` starts normalization at −1022. The Python cross-check mirrors both bugs, so it is not independent. Only extreme magnitudes are affected; no color or resolution result depends on them. | `conformance/fixtures/kernels/{cbrt,log2,exp2}.json`; `tools/reference-checker/src/kernels/hex64.ts`; `tools/kernel-crosscheck/kernels.py`; chapter 05 | **Fixed (errata, 2026-09-25):** both implementations corrected, and exactly the 199 affected vectors regenerated (inputs unchanged). Core, the reference checker, and the Python cross-check now agree on all 7,045 vectors. |
| F17 | **Merging identical diagnostics is unspecified.** Chapter 13 does not say whether two findings with the same code and location are reported once. | chapter 13 | **Open.** Core reports them once, as the reference checker does. Proposed errata: state this in chapter 13. |
| F18 | **The location of `OT-LIM-099` is unspecified.** | chapter 13 | **Open.** Core uses the validated document at pointer `""`. The reference checker always uses `theme`, even for preferences. Proposed errata: the validated document. |
| F19 | **Gamut mapping did not match its reference.** Chapter 05 cited the CSS Color 4 pseudocode, but every published result uses a different algorithm (linear-sRGB test and clip, bisection over a chroma scale factor, no early exit). | chapter 05 | **Fixed (errata, 2026-09-25):** normative pseudocode in chapter 05. Core implements it from the text: 0 differences in 20,000 samples. |
| F20 | **The color transformations were underspecified** (mix weights, when to gamut-map, composite quantization, A1 bisection bounds). | chapter 04; contracts/transformations.md | **Fixed (errata, 2026-09-25):** normative pseudocode in chapter 04. Core implements it from the text: 0 differences in 27,000 samples across all nine color operations. |
| F21 | **The reference `cbrt` contradicted chapter 05** (multiplied by a rounded 1/7 instead of dividing by 7). The golden vectors did not cover the affected inputs. | `tools/reference-checker/src/kernels/cbrt.ts`; `tools/kernel-crosscheck/kernels.py` | **Fixed (errata, 2026-09-25):** both use division. No vector or expected result changed. |
| F22 | **The resolved output violated FR-057**: composite members kept aliases, nested colors were unquantized, number and font-family encodings were undocumented, and `container.border` had no catalog default. | reference checker output; component catalog | **Fixed (errata):** chapter 10 "Resolved values"; baseline `border.default`; the reference resolves composites. |
| F23 | **The reference never applied theme component styling** (defaults and locks only, the `default` state only, no variants). | `tools/reference-checker/src/resolve/check.ts` | **Fixed (errata):** chapter 08 "Resolved components". Core and the reference agree byte for byte on all 259 fixtures and on every sweep (`crosscheck:core`, `crosscheck:core:sweeps`). |
| F24 | **An unannotated schema combinator failure mapped to `OT-META-001`** (the invalid-identifier code). | `tools/reference-checker/src/schema/validate.ts`; `invalid/cus/too-many-targets` | **Fixed (errata):** `OT-DOC-004` (chapter 13 mapping table); fixture corrected. |
| F25 | **Aliases to baseline tokens were rejected** as dangling, although baseline tokens always exist. | reference `validate/tokens.ts` | **Fixed (errata);** fixture `valid/ref/baseline-alias`. |
| F26 | **Reference token grammar diverged from the data model** (duration and density validated as numbers; composite members and sRGB bounds unchecked). Core also accepted hex-only color tokens and missed composite member ranges. | reference `validate/tokens.ts`; Core `validate/grammar.ts` | **Fixed:** the reference now checks literals against `tokens.schema.json` definitions (grammar with bounds removed → `OT-TOK-004`; full definition plus chapter 11 sRGB bounds → `OT-TOK-005`); Core requires `colorSpace` and `components` and bounds composite members. Eight new fixtures under `invalid/tok/` and `valid/tok/`. |
| F27 | **Validation did not evaluate derivations per mode** (chapter 04 requires it; token-valued operands were never domain-checked). The reference also reported `OT-REF-002` whenever a derivation operand aliased a non-color token. | reference `validate/a11y.ts`, `tokens/graph.ts` | **Fixed:** the reference evaluates each scheme at standard and high contrast and reports `OT-DRV-004` at an aliased operand out of domain; `OT-REF-002` applies only to a token's own alias. Three fixtures under `valid/drv/` and `invalid/drv/`. |
| F28 | **Component pointers were not RFC 6901-escaped** (`/components/com.example.notes/timeline`). | six resolution fixtures; reference | **Fixed (errata).** |
| F29 | **Undeclared layout regions passed through**, against chapter 08. | reference `validate/layout.ts`; `resolution/us5/unknown-region` | **Fixed (errata):** ignored with `OT-LAY-001`; five fixtures corrected. |
| F30 | **The reference checked high-contrast mode for one hard-coded overlay pair**, against chapter 11 (every pair in high-contrast mode is an `OT-A11Y-002` error). Sweeps accepted themes whose seeds pass 4.5:1 but fail 7:1; Core falls back from them. The validation procedure also did not say that step 12 needs an error-free document. | reference `validate/a11y.ts`; chapter 13 | **Fixed (errata):** the reference checks every non-disabled registry pair per supported scheme; chapter 13 states that step 12 runs only when no earlier step reported an error. No expected result changed. |
| F31 | **The accessibility conformance report (FR-064) was required but never defined**: no chapter said which modes and pairs it covers or where `OT-A11Y-003` is reported, and neither implementation emitted it. The FR-C028 admission gate depends on it. | chapter 11; `diagnostics.json` `OT-A11Y-003` (no fixture) | **Specified (errata):** chapter 11 "Accessibility conformance report". Validity and every expected result are unchanged. New conformance kind `accessibility-report` with four fixtures under `accessibility/`; the reference checker and Core implement it independently and agree (`crosscheck:core`). |
| F32 | **`ldexp` double-rounded subnormal results** in the reference checker and the Python cross-check (repeated halving); chapter 05 defines it as `m × 2^e`. Found by comparing Core's kernels with the Python kernels on 35,000 extra inputs (T118): 15 `exp2` results one ulp apart. | reference `kernels/hex64.ts`; `tools/kernel-crosscheck/kernels.py`; chapter 05 | **Fixed (errata):** chapter 05 states one rounding; 15 golden vectors added; no existing vector changed. `pnpm kernels:crosscheck` now also compares Core. |
| F33 | **`fontFamilyList` rejected every generic family**: its items were `oneOf: [familyName, genericFamily]`, and a generic name matches both. Hidden at `/tokens` (schema step suppressed there) but reported for overlay and preset values. Found while deriving the reference grammar from the schema (F26). | `defs/tokens.schema.json` | **Fixed (errata):** `anyOf`. Fixture `valid/ctx/overlay-font-family`. |

## Open Questions

- **Q1 (FR-C060)**: Resolved. See Clarifications, Session 2026-09-25.
- **Q2 (FR-C024)**: Resolved. See Clarifications, Session 2026-09-25.
- **Q3 (FR-C083)**: Resolved. See Clarifications, Session 2026-09-25.
- **Q4 (FR-C034)**: Resolved. See Clarifications, Session 2026-09-25. The Foundation errata
  (F5) is still to be done.
- **Q5 (F4)**: Resolved. See Clarifications, Session 2026-09-25.
- **Q6 (F1)**: Resolved. F1 was fixed as a Foundation errata before Core planning.
- **Q7**: Package naming and layout (for example, `@opentheme/core` in a new `packages/`
  workspace) and whether the in-memory store and presets ship in Core or in a sibling package.
  This is a plan-level question.

## Assumptions

- The Foundation's artifacts (`1.0.0-draft.1`) are the complete normative input. Core implements
  specification `1.0` and will track draft revisions until `1.0.0` is final (FR-C103).
- Core's first implementation language is TypeScript, matching the Foundation's toolchain
  (research R18). The specification stays language-neutral, and nothing here requires
  TypeScript.
- The constitution's "at least one local (on-device) preference store" is satisfied by an
  adapter-level or platform package in a later feature. Core itself stays storage-free (FR-C091).
- Applying different themes to different regions is done by several independent controllers
  (FR-C082). The Foundation leaves this to the runtime.
- Preference-change re-resolution uses the Foundation's context-change budget (4 ms on CI). R22
  defines no separate preference budget.
- The conformance runner, fixtures, and sweeps stay as they are, and Core conforms to them rather
  than the reverse.
- No git repository was present when this feature was created, so `002-core-runtime` exists as a
  Spec Kit feature directory and not as a git branch.
