# Feature Specification: OpenTheme Web Adapter

**Feature Branch**: `003-web-adapter`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "OpenTheme Web adapter (@opentheme/web): the first platform adapter
over @opentheme/core for web browsers. It turns a Core Resolved Theme into CSS custom properties
applied to a document (or a scoped element subtree), with a deterministic, documented
token-path-to-custom-property naming scheme and value serialization, including resolved component
contract properties and their states/variants. It reads platform context from the browser and
keeps it live, feeding Core's ThemeController. It provides a persistent PreferenceStore backed by
browser storage. It must support flash-free first paint, multiple independent scopes on one page,
and clean teardown. It must never execute theme-provided code, never inject untrusted text as CSS
without escaping/validation, add no runtime dependencies beyond @opentheme/core, and stay
framework-agnostic. Out of scope: framework-specific bindings, a theme editor UI, native/mobile
adapters, AI features, and any change to the Foundation or Core semantics."

## Overview

OpenTheme Core resolves a theme into a platform-neutral Resolved Theme, but a web page cannot use
that result directly. The Web adapter is the thin layer that makes OpenTheme usable on the web:
it writes the resolved values as CSS custom properties, tells Core what the browser and the user's
system currently prefer, and remembers the user's choices on the device. It adds no theming
behavior of its own: selection, validation, trust, policy, preferences enforcement, and
accessibility floors all stay in Core (constitution V).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Style a web page from a resolved theme (Priority: P1)

A web developer who has registered themes with Core applies the resolved theme to a page, or to one
region of it, and styles their interface with the documented custom property names. When the
theme or the context changes, the properties update in place.

**Why this priority**: Without this, OpenTheme produces nothing a browser can render. It is the
minimum useful adapter.

**Independent Test**: Resolve each reference theme in each mode, apply it to a test page, read
every custom property back, and decode it; every value equals Core's resolved value.

**Acceptance Scenarios**:

1. **Given** a resolved theme, **When** the developer applies it to the document, **Then** every
   standard token and every standard component property is available as a custom property with
   its documented name, and nothing else in the page is changed.
2. **Given** a resolved theme applied to a scoped element, **When** a different theme is applied to
   a sibling element, **Then** each subtree sees only its own values.
3. **Given** forced colors are active, **When** the theme is applied, **Then** color properties use
   the corresponding system colors instead of theme colors.
4. **Given** an applied theme, **When** the adapter is torn down, **Then** every property and every
   element or listener it added is removed.

---

### User Story 2 - Follow the user's system settings live (Priority: P1)

An end user switches their operating system to dark mode, turns on increased contrast, forced
colors, or reduced motion, or changes the page language or direction. The themed page follows
immediately, without a reload.

**Why this priority**: Honoring platform accessibility preferences is a constitutional
requirement (VIII), and live updates are required where the platform supports them (II).

**Independent Test**: Simulate each browser preference change and confirm that exactly one
re-resolution happens, the applied values change as Core specifies, and nothing changes for a
repeated identical signal.

**Acceptance Scenarios**:

1. **Given** a themed page in light mode, **When** the system switches to dark, **Then** the page
   shows the theme's dark mode within one update, without reloading.
2. **Given** the user requests reduced motion, **When** the page updates, **Then** motion
   durations take their reduced values as Core resolves them.
3. **Given** the host reports a new size class, **When** it changes, **Then** size-dependent values
   update; the adapter never derives a size class inside Core.
4. **Given** the user's explicit color-scheme choice in personalization, **When** the system
   preference changes, **Then** the explicit choice still wins, as Core's rules define.

---

### User Story 3 - Remember personalization on the device (Priority: P2)

An end user picks a theme and adjusts permitted settings. When they return to the site on the
same device, their choices are restored before the page is shown.

**Why this priority**: Constitution II requires at least one local store implementation, and
Core deliberately leaves platform storage to adapters.

**Independent Test**: Make choices, reload, and confirm the same document is read back; then make
storage unavailable or full and confirm the page still themes correctly and reports the failure.

**Acceptance Scenarios**:

1. **Given** saved preferences, **When** the page loads, **Then** they are applied from the first
   rendered frame.
2. **Given** storage is disabled, full, or throws, **When** preferences change, **Then** the page
   still applies them for the session and a store failure is reported, never an exception.
3. **Given** two independent scopes on one page, **When** each saves preferences, **Then** they do
   not overwrite each other.
4. **Given** stored data that is corrupt, oversized, or of a newer format, **When** it is read,
   **Then** it is treated as absent and left untouched, as Core specifies.

---

### User Story 4 - No flash of the wrong theme (Priority: P2)

A site renders on the server or from static HTML. The first paint already shows the user's theme,
and the client takes over without visible change.

**Why this priority**: Constitution VIII requires resolving the active theme before first paint.

**Independent Test**: Produce the initial stylesheet and initial preferences for a request, render
the page with them, then start the client; the applied values are byte-identical before and after
hand-over and no intermediate state is painted.

**Acceptance Scenarios**:

1. **Given** a request with known preferences and context, **When** the host asks for the initial
   stylesheet, **Then** it receives text that, inlined in the page, styles the first paint
   identically to the running client.
2. **Given** the client starts on a server-rendered page, **When** it resolves the same inputs,
   **Then** it does not rewrite unchanged values.

---

### User Story 5 - Unsafe values never reach the page (Priority: P1)

A developer admits a user-supplied or AI-generated theme as untrusted. Whatever the theme
contains, the adapter only ever writes values it has serialized from Core's typed resolved
output, so nothing from the theme can break out of a declaration or run code.

**Why this priority**: Constitution VI is non-negotiable.

**Independent Test**: Apply every malicious conformance fixture that Core admits and resolves;
confirm every written value matches the serialization grammar and no stylesheet structure changes.

**Acceptance Scenarios**:

1. **Given** a theme whose strings contain CSS syntax, URLs, or markup, **When** it is applied,
   **Then** those strings never appear in any written value (Core rejects them, and the adapter
   writes only typed values).
2. **Given** a font family name, **When** it is written, **Then** it is quoted and escaped so it
   cannot end the declaration.

### Edge Cases

- A token or component path produces a custom property name that collides with another after
  normalization: naming is injective by construction, and a collision is a defect caught by tests.
- The browser lacks a media feature (for example `prefers-contrast` or `forced-colors`): the
  adapter uses the documented default for that context value and never guesses.
- Storage exists but throws on access (privacy modes, sandboxed frames): the store reports
  `store-read-failed` / `store-write-failed` through Core and the page keeps working.
- Two adapters target the same element: the second is refused with an error; scopes never share
  mutable state.
- The document's `lang` is missing or not a valid language tag: the adapter uses the host-supplied
  default locale.
- A scope's element is removed from the page: teardown stays safe to call and is idempotent.
- A theme resolves to an unchanged result after a context signal: nothing is rewritten.

## Requirements *(mandatory)*

### Functional Requirements

**Output: resolved theme to CSS**

- **FR-W001**: The adapter MUST turn a Core Resolved Theme into a set of CSS custom property
  declarations covering every resolved token and every resolved component property, state, and
  variant, and nothing else.
- **FR-W002**: Custom property names MUST follow one documented, deterministic, injective naming
  scheme derived only from token paths and component contract identifiers (never from theme
  display text). The scheme and its version MUST be published as part of the adapter's contract.
- **FR-W003**: Every value MUST be serialized from its typed resolved form by one documented
  grammar per type: colors (quantized sRGB and alpha), dimensions, numbers, durations, font-family
  lists (always quoted and escaped), cubic Béziers, stroke styles, border, shadow, and typography
  composites, and forced-colors system colors. No theme-provided string is written unserialized.
- **FR-W004**: Serialization MUST be deterministic: the same Resolved Theme always produces
  byte-identical declarations in a documented order.
- **FR-W005**: The adapter MUST be able to apply declarations to the document root or to a
  host-chosen element scope, and MUST touch only the properties it owns in that scope.
- **FR-W006**: The adapter MUST also produce the declarations as stylesheet text, without a
  browser, for server rendering and static pages.
- **FR-W007**: After an update, the adapter MUST change only the properties whose values changed.

**Context: browser signals to Core**

- **FR-W010**: The adapter MUST derive Core's platform context from the browser: color scheme,
  increased contrast, forced colors, and reduced motion from media features; direction and locale
  from the scope's document (with host overrides).
- **FR-W011**: The size class MUST be supplied by the host. The adapter MAY offer an optional
  helper that maps a host-chosen width to a size class using the registry's published thresholds;
  Core never receives or infers pixel widths.
- **FR-W012**: The text scale MUST be supplied by the host, defaulting to 1. The adapter MAY offer
  an optional helper that measures it from the root font size.
- **FR-W013**: The adapter MUST keep context live by listening to media feature and document
  changes, and MUST forward each effective change to the Core controller exactly once. Repeated
  identical signals MUST cause no update.
- **FR-W014**: Missing media features MUST map to the documented defaults (`no-preference`,
  `standard`, `false`), never to guessed values.

**Persistence**

- **FR-W020**: The adapter MUST provide a Core Preference Store backed by the browser's persistent
  per-origin storage, keyed by scope, so independent scopes never overwrite each other.
- **FR-W021**: Storage failures (unavailable, full, throwing) MUST surface as Core's store
  operational errors and never as uncaught exceptions; the page MUST keep working with in-memory
  state.
- **FR-W022**: The adapter MUST read stored preferences synchronously when the host asks, so the
  first resolution can use them (Core FR-C092).
- **FR-W023**: The adapter MUST NOT transmit preferences anywhere; it stores only Core's canonical
  User Preferences document bytes.

**First paint, scopes, and lifecycle**

- **FR-W030**: The adapter MUST support flash-free first paint: given preferences and context, the
  host can produce the initial stylesheet (and the same initial preferences for the client), and
  the client's first application MUST NOT rewrite values that are already correct.
- **FR-W031**: Multiple independent scopes MUST be supported on one page, each with its own
  controller, context, store key, and element, without shared mutable state.
- **FR-W032**: Teardown MUST remove every property, stylesheet, and listener the adapter added,
  and MUST be idempotent.
- **FR-W033**: Attaching a second adapter to an element already managed MUST be refused with an
  error.

**Safety and boundaries**

- **FR-W040**: The adapter MUST NOT execute, evaluate, or import anything from a theme, and MUST
  write only values produced by its own serializers from Core's typed output (constitution VI).
- **FR-W041**: The adapter MUST NOT reimplement or alter validation, resolution, trust, policy, or
  preference enforcement; all of these stay in Core (constitution V).
- **FR-W042**: The adapter MUST have no runtime dependency other than `@opentheme/core` and MUST
  NOT depend on any UI framework.
- **FR-W043**: Gaps found in the Foundation or Core while building the adapter MUST be recorded as
  findings, not silently worked around in the adapter.

**Conformance and documentation**

- **FR-W050**: The adapter MUST pass a shared output-target conformance check: for every resolution
  fixture, decoding the adapter's declarations yields exactly Core's resolved values (constitution
  V).
- **FR-W051**: The naming scheme, serialization grammar, and context mapping MUST be documented
  with examples that run in CI, plus an agent guide covering integration and common mistakes.

### Key Entities

- **Scope**: One themed region: an element (or the document root), its Core controller, its
  context source, and its preference store key.
- **Declaration Set**: The ordered custom property name/value pairs produced from one Resolved
  Theme; the unit of application, diffing, and server rendering.
- **Naming Scheme**: The versioned mapping from token paths and component property paths to
  custom property names.
- **Context Source**: The live mapping from browser signals (and host inputs) to Core's platform
  and environment context.
- **Browser Preference Store**: The persistent, per-scope store of Core User Preferences document
  bytes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-W001**: For 100% of Core's resolution fixtures, decoding the adapter's output reproduces
  Core's resolved values exactly.
- **SC-W002**: For 100% of malicious and invalid fixtures admitted through Core, every written
  value matches the serialization grammar; no declaration can be escaped.
- **SC-W003**: A context change (for example switching to dark mode) is reflected on screen within
  one frame after the signal, and an identical repeated signal causes zero writes.
- **SC-W004**: A server-rendered page shows the correct theme on first paint, and client start-up
  causes zero property changes when inputs are unchanged.
- **SC-W005**: With storage disabled or full, 100% of preference operations still apply for the
  session and report a store failure; zero uncaught errors.
- **SC-W006**: Applying a typical theme's full declaration set to a scope takes at most 4 ms
  median, and an update after a context change at most 4 ms median including Core's
  re-resolution, on the same CI benchmark as Core.
- **SC-W007**: The adapter adds at most 10 KB (compressed) on top of Core and has zero runtime
  dependencies besides Core.
- **SC-W008**: A developer can theme a page end to end by following the README quickstart, whose
  examples run in CI.

## Assumptions

- The naming scheme and serialization grammar are the adapter's own versioned contract, not part
  of the Theme Specification; a future Foundation chapter may adopt them.
- Persistent storage uses the browser's per-origin key-value storage; hosts needing other storage
  (cookies, IndexedDB, remote sync) supply their own Core Preference Store.
- The browser offers no reliable text-scale signal, so the host supplies it (default 1).
- Size classes are host decisions; the optional helper uses the registry thresholds (600 px and
  1024 px) only when the host asks.
- Supported browsers are current evergreen browsers with CSS custom properties and media query
  change events; very old browsers are out of scope.
- Framework bindings (React, Vue, Svelte, Web Components) are separate future features built on
  this adapter.
